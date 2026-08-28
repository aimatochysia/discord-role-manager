'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { errorEmbed, successEmbed, embed } = require('../../utils/embeds');
const { requestEmbed, requestComponents } = require('../../services/trainee');
const { executeModeration } = require('../../services/moderation');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trainee')
    .setDescription('Review moderator-trainee requests')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('pending').setDescription('List pending requests'))
    .addSubcommand((sub) =>
      sub
        .setName('approve')
        .setDescription('Approve a request by id')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Request id').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('deny')
        .setDescription('Deny a request by id')
        .addIntegerOption((opt) => opt.setName('id').setDescription('Request id').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Why'))
    ),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    const sub = interaction.options.getSubcommand();
    if (sub === 'pending') {
      if (!can(state.rankKeys, CAPABILITIES.VIEW_MOD_QUEUE)) {
        await interaction.reply({ embeds: [errorEmbed('You cannot view the trainee queue.')], ephemeral: true });
        return;
      }
      const rows = await ctx.repos.listRequests(interaction.guild.id, 'pending');
      if (!rows.length) {
        await interaction.reply({ embeds: [successEmbed('Queue empty', 'No pending trainee requests.')], ephemeral: true });
        return;
      }
      const latest = rows[0];
      await interaction.reply({
        embeds: [
          embed({
            title: `${rows.length} pending request${rows.length === 1 ? '' : 's'}`,
            description: rows
              .slice(0, 15)
              .map((row) => `**#${row.id}** \`${row.action_type}\` by <@${row.requester_id}>`)
              .join('\n')
          }),
          requestEmbed(latest, `<@${latest.requester_id}>`)
        ],
        components: requestComponents(latest.id),
        ephemeral: true
      });
      return;
    }

    if (!can(state.rankKeys, CAPABILITIES.APPROVE_TRAINEE)) {
      await interaction.reply({ embeds: [errorEmbed('Only moderators and above can approve or deny.')], ephemeral: true });
      return;
    }
    const id = interaction.options.getInteger('id', true);
    const request = await ctx.repos.getRequest(id);
    if (!request || request.guild_id !== interaction.guild.id || request.status !== 'pending') {
      await interaction.reply({ embeds: [errorEmbed('That request is not pending.')], ephemeral: true });
      return;
    }
    if (sub === 'deny') {
      await ctx.repos.reviewRequest(id, {
        status: 'denied',
        reviewerId: interaction.user.id,
        note: interaction.options.getString('reason')
      });
      await interaction.reply({ embeds: [successEmbed('Denied', `Request #${id} was denied.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const result = await executeModeration(interaction.guild, request);
    await ctx.repos.reviewRequest(id, { status: 'approved', reviewerId: interaction.user.id, note: result });
    await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'trainee_approve', { id, result });
    await interaction.editReply({ embeds: [successEmbed(`Approved #${id}`, result)] });
  }
};
