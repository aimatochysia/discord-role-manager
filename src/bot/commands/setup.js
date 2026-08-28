'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { ensureRanks, seedEnvDefaults } = require('../../services/setup');
const { successEmbed, errorEmbed } = require('../../utils/embeds');
const { RANKS } = require('../../config/ranks');
const { loadGuildState, statusEmbed, can, CAPABILITIES } = require('../gui');
const { postVerificationPanel } = require('../../services/verification');
const { ensureBoosterCategoryProfile, syncGuildBoosters } = require('../../services/booster');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create ranks, bind roles, and configure verification / boosters')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((sub) => sub.setName('roles').setDescription('Create missing rank roles and bind them'))
    .addSubcommand((sub) => sub.setName('status').setDescription('Show what is configured'))
    .addSubcommand((sub) =>
      sub
        .setName('verify')
        .setDescription('Set the verification channel and post the ✅ panel')
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('Gate channel for new members').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('booster')
        .setDescription('Set the booster-only category')
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category boosters should see')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
    ),
  async execute(interaction, ctx) {
    const sub = interaction.options.getSubcommand();
    const state = await loadGuildState(interaction, ctx.repos);

    if (sub === 'status') {
      await interaction.reply({ embeds: [statusEmbed(state.guild, state.bindings, state.settings, state.rankKeys)], ephemeral: true });
      return;
    }

    if (!can(state.rankKeys, CAPABILITIES.MANAGE_BOT_SETTINGS) && !can(state.rankKeys, CAPABILITIES.MANAGE_VERIFICATION)) {
      await interaction.reply({ embeds: [errorEmbed('Only owner, developer, or administrator can run setup.')], ephemeral: true });
      return;
    }

    if (sub === 'roles') {
      await interaction.deferReply({ ephemeral: true });
      const result = await ensureRanks(interaction.guild, ctx.repos);
      await seedEnvDefaults(interaction.guild, ctx.repos, ctx.env);
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'setup_roles', { created: result.created });
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Ranks ready',
            [
              result.created.length ? `Created: ${result.created.join(', ')}` : 'All rank roles already existed and were bound.',
              '',
              'Put the bot role **above** these roles or it cannot assign them.',
              'These roles do **not** use Discord Administrator — otherwise channel overwrites would be ignored.'
            ].join('\n')
          )
        ]
      });
      return;
    }

    if (sub === 'verify') {
      const channel = interaction.options.getChannel('channel', true);
      await interaction.deferReply({ ephemeral: true });
      await ctx.repos.upsertRule(interaction.guild.id, 'channel', channel.id, { profileKey: 'gate', inherit: false });
      if (channel.parentId) {
        await ctx.repos.upsertRule(interaction.guild.id, 'category', channel.parentId, { profileKey: 'gate', inherit: false });
      }
      const message = await postVerificationPanel(channel, interaction.guild.name);
      await ctx.repos.upsertSettings(interaction.guild.id, {
        verify_channel_id: channel.id,
        verify_message_id: message.id
      });
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'setup_verify', { channelId: channel.id });
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Verification posted',
            `New members should only see ${channel}. Any reaction on that message (or the button) grants **${RANKS.newbie.label}**. You can also put this message id in \`VERIFY_MESSAGE_ID\` in .env. Apply access afterwards so other channels hide @everyone.`
          )
        ]
      });
      return;
    }

    if (sub === 'booster') {
      const category = interaction.options.getChannel('category', true);
      await ensureBoosterCategoryProfile(ctx.repos, interaction.guild.id, category.id);
      await ctx.repos.upsertSettings(interaction.guild.id, { booster_category_id: category.id, auto_booster: true });
      const sync = await syncGuildBoosters(interaction.guild, ctx.repos);
      await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'setup_booster', { categoryId: category.id, sync });
      await interaction.reply({
        embeds: [
          successEmbed(
            'Booster category set',
            `${category} uses the **Booster perks** profile. Current boosters synced (${sync.added || 0} added). Apply access to write Discord overwrites.`
          )
        ],
        ephemeral: true
      });
    }
  }
};
