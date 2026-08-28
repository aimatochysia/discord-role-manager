'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { loadGuildState, can, CAPABILITIES } = require('../gui');
const { errorEmbed, successEmbed } = require('../../utils/embeds');
const { PROFILES } = require('../../config/profiles');

const profileChoices = Object.values(PROFILES)
  .filter((profile) => !profile.isInherit && profile.key !== 'custom')
  .slice(0, 25)
  .map((profile) => ({ name: profile.label, value: profile.key }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('category')
    .setDescription('Create or rename categories (administrator)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a category')
        .addStringOption((opt) => opt.setName('name').setDescription('Category name').setRequired(true))
        .addStringOption((opt) =>
          opt.setName('profile').setDescription('Access profile').setRequired(true).addChoices(...profileChoices)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename a category')
        .addChannelOption((opt) =>
          opt.setName('category').setDescription('Category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
        .addStringOption((opt) => opt.setName('name').setDescription('New name').setRequired(true))
    ),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    if (!can(state.rankKeys, CAPABILITIES.MANAGE_CATEGORIES)) {
      await interaction.reply({ embeds: [errorEmbed('Administrators and owners can manage categories.')], ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const profile = interaction.options.getString('profile', true);
      const category = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildCategory,
        reason: `Created by ${interaction.user.tag}`
      });
      await ctx.repos.upsertRule(interaction.guild.id, 'category', category.id, { profileKey: profile, inherit: false });
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'category_create', { categoryId: category.id, profile });
      await interaction.reply({
        embeds: [successEmbed('Category created', `${category} · **${PROFILES[profile].label}**. Add channels, then \`/access apply\`.`)],
        ephemeral: true
      });
      return;
    }
    const category = interaction.options.getChannel('category', true);
    const name = interaction.options.getString('name', true);
    await category.setName(name, `Renamed by ${interaction.user.tag}`);
    await interaction.reply({ embeds: [successEmbed('Renamed', `${category}`)], ephemeral: true });
  }
};
