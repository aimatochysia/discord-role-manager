'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { panelEmbed, panelComponents, loadGuildState } = require('../gui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Open the role manager control panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    await interaction.reply({
      embeds: [panelEmbed(state.guild, state.rankKeys)],
      components: panelComponents(),
      ephemeral: true
    });
  }
};
