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
    .setName('channel')
    .setDescription('Create, move, or rename channels (administrator)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a text channel')
        .addStringOption((opt) => opt.setName('name').setDescription('Channel name').setRequired(true))
        .addChannelOption((opt) =>
          opt.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory)
        )
        .addStringOption((opt) =>
          opt.setName('profile').setDescription('Access profile (default: inherit)').addChoices(...profileChoices)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('move')
        .setDescription('Move a channel into a category')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to move').setRequired(true))
        .addChannelOption((opt) =>
          opt.setName('category').setDescription('Destination category').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename a channel')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel').setRequired(true))
        .addStringOption((opt) => opt.setName('name').setDescription('New name').setRequired(true))
    ),
  async execute(interaction, ctx) {
    const state = await loadGuildState(interaction, ctx.repos);
    if (!can(state.rankKeys, CAPABILITIES.MANAGE_CHANNELS)) {
      await interaction.reply({ embeds: [errorEmbed('Administrators and owners can manage channels.')], ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const name = interaction.options.getString('name', true);
      const category = interaction.options.getChannel('category');
      const profile = interaction.options.getString('profile');
      const channel = await interaction.guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category?.id,
        reason: `Created by ${interaction.user.tag}`
      });
      if (profile) {
        await ctx.repos.upsertRule(interaction.guild.id, 'channel', channel.id, { profileKey: profile, inherit: false });
      }
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'channel_create', { channelId: channel.id, profile });
      await interaction.reply({
        embeds: [successEmbed('Channel created', `${channel}${profile ? ` · profile **${PROFILES[profile].label}**` : ' · inherits category'}`)],
        ephemeral: true
      });
      return;
    }

    if (sub === 'move') {
      const channel = interaction.options.getChannel('channel', true);
      const category = interaction.options.getChannel('category', true);
      await channel.setParent(category.id, { lockPermissions: true, reason: `Moved by ${interaction.user.tag}` });
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'channel_move', {
        channelId: channel.id,
        categoryId: category.id
      });
      await interaction.reply({
        embeds: [successEmbed('Channel moved', `${channel} is now under ${category} and synced to the category permissions.`)],
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);
    const name = interaction.options.getString('name', true);
    await channel.setName(name, `Renamed by ${interaction.user.tag}`);
    await interaction.reply({ embeds: [successEmbed('Renamed', `${channel}`)], ephemeral: true });
  }
};
