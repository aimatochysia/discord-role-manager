'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { renderAccessMap } = require('../../services/canvasMap');
const { errorEmbed } = require('../../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('map')
    .setDescription('Render a visual map of categories, channels, and access profiles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    if (!can(state.rankKeys, CAPABILITIES.GENERATE_MAP) && !can(state.rankKeys, CAPABILITIES.VIEW_STRUCTURE)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot generate the server map.')], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const buffers = renderAccessMap(state.structure);
    const files = buffers.map((buffer, index) => new AttachmentBuilder(buffer, { name: `access-map-${index + 1}.png` }));
    await interaction.editReply({
      content: `Access map for **${interaction.guild.name}** (${files.length} page${files.length === 1 ? '' : 's'}).`,
      files
    });
  }
};
