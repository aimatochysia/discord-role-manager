'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embed, OK } = require('../utils/embeds');

async function grantNewbie(member, bindings, reason = 'Verification') {
  const newbieId = bindings.newbie;
  if (!newbieId) {
    throw new Error('Newbie role is not bound. Run /setup roles.');
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

function verificationEmbed(guildName) {
  return embed({
    title: `Welcome to ${guildName}`,
    description: [
      'New members can only see this channel until they accept the rules.',
      '',
      'React with ✅ **or** press the button below to receive **Newbie** and unlock the rest of the server.',
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
  verificationEmbed,
  verificationComponents,
  postVerificationPanel,
  handleJoin
};
