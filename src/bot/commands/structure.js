'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { embed, errorEmbed } = require('../../utils/embeds');
const { PROFILES } = require('../../config/profiles');

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('structure')
    .setDescription('List categories and channels with their access profiles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    if (!can(state.rankKeys, CAPABILITIES.VIEW_STRUCTURE)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot view the structure.')], ephemeral: true });
      return;
    }
    const lines = [];
    for (const category of state.structure.categories) {
      const profile = PROFILES[category.access?.profileKey]?.label || category.access?.profileKey;
      lines.push(`**${category.name}** · ${profile}`);
      for (const channel of category.channels) {
        const label = channel.access?.inherit
          ? 'inherit'
          : PROFILES[channel.access?.profileKey]?.label || channel.access?.profileKey;
        lines.push(` #${channel.name} · ${label}`);
      }
    }
    const pages = chunk(lines, 40);
    const embeds = pages.map((page, index) =>
      embed({
        title: `${interaction.guild.name} structure`,
        description: page.join('\n') || '_Empty server_',
        footer: `Page ${index + 1}/${pages.length || 1}`
      })
    );
    await interaction.reply({ embeds: embeds.slice(0, 8), ephemeral: true });
  }
};
