'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { RANKS, RANK_KEYS } = require('../../config/ranks');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { errorEmbed, successEmbed, embed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roles')
    .setDescription('Bind Discord roles to bot ranks')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('list').setDescription('Show rank bindings'))
    .addSubcommand((sub) =>
      sub
        .setName('bind')
        .setDescription('Bind a Discord role to a rank')
        .addStringOption((opt) =>
          opt
            .setName('rank')
            .setDescription('Bot rank')
            .setRequired(true)
            .addChoices(...RANK_KEYS.map((key) => ({ name: RANKS[key].label, value: key })))
        )
        .addRoleOption((opt) => opt.setName('role').setDescription('Discord role').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('unbind')
        .setDescription('Remove a rank binding')
        .addStringOption((opt) =>
          opt
            .setName('rank')
            .setDescription('Bot rank')
            .setRequired(true)
            .addChoices(...RANK_KEYS.map((key) => ({ name: RANKS[key].label, value: key })))
        )
    ),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
      const lines = RANK_KEYS.map((key) => {
        const roleId = state.bindings[key];
        return `**${RANKS[key].label}** — ${roleId ? `<@&${roleId}>` : '_unbound_'}`;
      });
      await interaction.reply({
        embeds: [embed({ title: 'Rank bindings', description: lines.join('\n') })],
        ephemeral: true
      });
      return;
    }
    if (!can(state.rankKeys, CAPABILITIES.MANAGE_BOT_SETTINGS) && !can(state.rankKeys, CAPABILITIES.ASSIGN_MODERATOR)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot change rank bindings.')], ephemeral: true });
      return;
    }
    const rank = interaction.options.getString('rank', true);
    if (sub === 'bind') {
      const role = interaction.options.getRole('role', true);
      await ctx.repos.setBinding(interaction.guild.id, rank, role.id);
      await interaction.reply({
        embeds: [successEmbed('Bound', `**${RANKS[rank].label}** → ${role}`)],
        ephemeral: true
      });
      return;
    }
    await ctx.repos.deleteBinding(interaction.guild.id, rank);
    await interaction.reply({ embeds: [successEmbed('Unbound', `**${RANKS[rank].label}** is no longer bound.`)], ephemeral: true });
  }
};
