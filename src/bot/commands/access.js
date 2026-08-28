'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { PROFILES } = require('../../config/profiles');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { loadGuildState, can, CAPABILITIES, accessBrowserPayload } = require('../gui');
const { buildGuildApplyPlan, applyPlanToGuild } = require('../../services/apply');

const profileChoices = Object.values(PROFILES)
  .filter((profile) => !profile.isInherit)
  .slice(0, 25)
  .map((profile) => ({ name: profile.label, value: profile.key }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('access')
    .setDescription('See and assign who can view / chat in categories and channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('gui').setDescription('Open the interactive access manager'))
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Assign an access profile to a channel or category')
        .addStringOption((opt) =>
          opt.setName('profile').setDescription('Access profile').setRequired(true).addChoices(...profileChoices)
        )
        .addChannelOption((opt) => opt.setName('target').setDescription('Channel or category').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('apply').setDescription('Write configured access to Discord overwrites')),
  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    const state = await loadGuildState(interaction, ctx.repos);

    if (sub === 'gui') {
      await interaction.reply({ ...accessBrowserPayload(state.structure, 0), ephemeral: true });
      return;
    }

    if (sub === 'set') {
      if (!can(state.rankKeys, CAPABILITIES.MANAGE_ACCESS_CONFIG)) {
        await interaction.reply({ embeds: [errorEmbed('You cannot change access profiles.')], ephemeral: true });
        return;
      }
      const profile = interaction.options.getString('profile', true);
      const target = interaction.options.getChannel('target', true);
      const isCategory = target.type === ChannelType.GuildCategory;
      await ctx.repos.upsertRule(interaction.guild.id, isCategory ? 'category' : 'channel', target.id, {
        profileKey: profile,
        inherit: false
      });
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'access_set', {
        targetId: target.id,
        profile
      });
      await interaction.reply({
        embeds: [successEmbed('Profile saved', `${target} is now **${PROFILES[profile].label}**. Run \`/access apply\` to write Discord overwrites.`)],
        ephemeral: true
      });
      return;
    }

    if (sub === 'apply') {
      if (!can(state.rankKeys, CAPABILITIES.APPLY_ACCESS)) {
        await interaction.reply({ embeds: [errorEmbed('You cannot apply overwrites.')], ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const { plan, summary } = await buildGuildApplyPlan(interaction.guild, ctx.repos);
      const result = await applyPlanToGuild(interaction.guild, plan);
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'apply_access', { summary, errors: result.errors });
      const extra = result.errors.length
        ? `\n\nErrors:\n${result.errors.slice(0, 8).map((err) => `• ${err.name}: ${err.error}`).join('\n')}`
        : '';
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Access applied',
            `Updated **${summary.targets}** targets (${summary.inherited} inherited, ${summary.explicit} explicit).${extra}`
          )
        ]
      });
    }
  }
};
