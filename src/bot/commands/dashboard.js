'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { randomToken, sha256 } = require('../../utils/crypto');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get a magic link to the web access dashboard')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    if (!can(state.rankKeys, CAPABILITIES.VIEW_DASHBOARD)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot open the dashboard.')], ephemeral: true });
      return;
    }
    const token = randomToken(32);
    const expires = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await ctx.repos.createSession({
      tokenHash: sha256(token),
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      expiresAt: expires
    });
    const url = `${ctx.env.dashboardPublicUrl.replace(/\/$/, '')}/auth/magic?token=${token}`;
    const payload = {
      embeds: [
        successEmbed(
          'Dashboard link',
          [
            `[Open the access dashboard](${url})`,
            '',
            'The link is tied to your Discord account and expires in 12 hours.',
            'Use it to assign view/chat on every category without fighting Discord\'s overwrite UI.'
          ].join('\n')
        )
      ],
      ephemeral: true
    };
    try {
      await interaction.user.send(payload);
      await interaction.reply({
        embeds: [successEmbed('Check your DMs', 'I sent you a dashboard magic link. If you did not get it, enable DMs from server members.')],
        ephemeral: true
      });
    } catch {
      await interaction.reply(payload);
    }
  }
};
