'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { authorizeAction } = require('../../config/ranks');
const { loadGuildState } = require('../gui');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { executeModeration } = require('../../services/moderation');
const { submitRequest, requestEmbed, requestComponents } = require('../../services/trainee');

function durationToMs(input) {
  if (!input) return 10 * 60 * 1000;
  const match = String(input).trim().match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return 10 * 60 * 1000;
  const n = Number(match[1]);
  const unit = (match[2] || 'm').toLowerCase();
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * (mult[unit] || 60000);
}

async function handlePlayerAction(interaction, ctx, action, payload) {
  const state = await loadGuildState(interaction, ctx.repos);
  const decision = authorizeAction(state.rankKeys, action);
  if (decision === 'deny') {
    await interaction.reply({
      embeds: [errorEmbed('You cannot do that. Developers cannot moderate players; trainees must request approval.')],
      ephemeral: true
    });
    return;
  }
  if (decision === 'request') {
    const request = await submitRequest(ctx.repos, {
      guildId: interaction.guild.id,
      requesterId: interaction.user.id,
      actionType: action,
      payload,
      channelId: interaction.channelId
    });
    const message = await interaction.channel.send({
      embeds: [requestEmbed(request, interaction.user.tag)],
      components: requestComponents(request.id)
    });
    await ctx.repos.reviewRequest(request.id, { status: 'pending', reviewerId: null, note: null }).catch(() => null);
    await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'trainee_request', { id: request.id, action });
    await interaction.reply({
      embeds: [successEmbed('Request submitted', `Request **#${request.id}** is waiting for a moderator.`)],
      ephemeral: true
    });
    if (message) {
      await ctx.knex('trainee_requests').where({ id: request.id }).update({ message_id: message.id });
    }
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const result = await executeModeration(interaction.guild, { action_type: action, payload });
  await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, action, payload);
  await interaction.editReply({ embeds: [successEmbed('Done', result)] });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Chat and member moderation (trainees need approval for member actions)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('timeout')
        .setDescription('Timeout a member')
        .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((opt) => opt.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('kick')
        .setDescription('Kick a member')
        .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a member (administrator)')
        .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason'))
    )
    .addSubcommand((sub) =>
      sub
        .setName('purge')
        .setDescription('Delete recent messages in this channel')
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('1-100').setRequired(true).setMinValue(1).setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('slowmode')
        .setDescription('Set slowmode in this channel')
        .addIntegerOption((opt) =>
          opt.setName('seconds').setDescription('0 to disable').setRequired(true).setMinValue(0).setMaxValue(21600)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('nick')
        .setDescription('Change a member nickname')
        .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((opt) => opt.setName('nickname').setDescription('New nickname (empty to clear)'))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason'))
    ),
  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'timeout') {
      const user = interaction.options.getUser('user', true);
      await handlePlayerAction(interaction, ctx, 'timeout', {
        targetUserId: user.id,
        targetTag: user.tag,
        durationMs: durationToMs(interaction.options.getString('duration')),
        reason: interaction.options.getString('reason') || 'No reason provided'
      });
      return;
    }
    if (sub === 'kick') {
      const user = interaction.options.getUser('user', true);
      await handlePlayerAction(interaction, ctx, 'kick', {
        targetUserId: user.id,
        targetTag: user.tag,
        reason: interaction.options.getString('reason') || 'No reason provided'
      });
      return;
    }
    if (sub === 'ban') {
      const user = interaction.options.getUser('user', true);
      await handlePlayerAction(interaction, ctx, 'ban', {
        targetUserId: user.id,
        targetTag: user.tag,
        reason: interaction.options.getString('reason') || 'No reason provided'
      });
      return;
    }
    if (sub === 'nick') {
      const user = interaction.options.getUser('user', true);
      await handlePlayerAction(interaction, ctx, 'nick', {
        targetUserId: user.id,
        targetTag: user.tag,
        nickname: interaction.options.getString('nickname') || null,
        reason: interaction.options.getString('reason') || 'Nickname update'
      });
      return;
    }

    const state = await loadGuildState(interaction, ctx.repos);
    const decision = authorizeAction(state.rankKeys, sub);
    if (decision !== 'allow') {
      await interaction.reply({ embeds: [errorEmbed('You cannot manage chat.')], ephemeral: true });
      return;
    }
    if (sub === 'purge') {
      await interaction.deferReply({ ephemeral: true });
      const result = await executeModeration(interaction.guild, {
        action_type: 'purge',
        payload: { channelId: interaction.channelId, limit: interaction.options.getInteger('amount', true) }
      });
      await interaction.editReply({ embeds: [successEmbed('Purged', result)] });
      return;
    }
    if (sub === 'slowmode') {
      const seconds = interaction.options.getInteger('seconds', true);
      const result = await executeModeration(interaction.guild, {
        action_type: 'slowmode',
        payload: { channelId: interaction.channelId, seconds }
      });
      await interaction.reply({ embeds: [successEmbed('Slowmode', result)], ephemeral: true });
    }
  },
  durationToMs
};
