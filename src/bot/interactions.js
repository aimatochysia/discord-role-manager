'use strict';

const { AttachmentBuilder } = require('discord.js');
const { errorEmbed, successEmbed, embed } = require('../utils/embeds');
const { renderAccessMap } = require('../services/canvasMap');
const { grantNewbie } = require('../services/verification');
const { executeModeration } = require('../services/moderation');
const { requestEmbed, requestComponents } = require('../services/trainee');
const { ensureRanks, seedEnvDefaults } = require('../services/setup');
const { syncGuildBoosters, ensureBoosterCategoryProfile } = require('../services/booster');
const { buildGuildApplyPlan, applyPlanToGuild } = require('../services/apply');
const { randomToken, sha256 } = require('../utils/crypto');
const { PROFILES } = require('../config/profiles');
const {
  loadGuildState,
  can,
  CAPABILITIES,
  panelEmbed,
  panelComponents,
  accessBrowserPayload,
  categoryEditorPayload,
  channelEditorPayload,
  statusEmbed,
  findCategory,
  findChannel
} = require('./gui');

async function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.update ? interaction.update(payload) : interaction.reply(payload);
}

async function handlePanel(interaction, ctx, action) {
  const state = await loadGuildState(interaction, ctx.repos);
  if (action === 'home') {
    await interaction.update({
      embeds: [panelEmbed(state.guild, state.rankKeys)],
      components: panelComponents(),
      files: []
    });
    return;
  }
  if (action === 'access') {
    await interaction.update({ ...accessBrowserPayload(state.structure, 0), files: [] });
    return;
  }
  if (action === 'map') {
    if (!can(state.rankKeys, CAPABILITIES.GENERATE_MAP) && !can(state.rankKeys, CAPABILITIES.VIEW_STRUCTURE)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot generate the map.')], ephemeral: true });
      return;
    }
    await interaction.deferUpdate();
    const buffers = renderAccessMap(state.structure);
    const files = buffers.map((buffer, index) => new AttachmentBuilder(buffer, { name: `access-map-${index + 1}.png` }));
    await interaction.editReply({
      content: `Access map for **${interaction.guild.name}**`,
      embeds: [],
      components: panelComponents(),
      files
    });
    return;
  }
  if (action === 'structure') {
    const lines = [];
    for (const category of state.structure.categories.slice(0, 12)) {
      lines.push(`**${category.name}** · ${PROFILES[category.access?.profileKey]?.label || 'unset'}`);
      for (const channel of category.channels.slice(0, 8)) {
        lines.push(`- #${channel.name}`);
      }
    }
    await interaction.update({
      embeds: [embed({ title: 'Structure snapshot', description: lines.join('\n') || '_Empty_' })],
      components: panelComponents(),
      files: []
    });
    return;
  }
  if (action === 'setup') {
    if (!can(state.rankKeys, CAPABILITIES.MANAGE_BOT_SETTINGS)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot run setup.')], ephemeral: true });
      return;
    }
    await interaction.deferUpdate();
    const result = await ensureRanks(interaction.guild, ctx.repos);
    await seedEnvDefaults(interaction.guild, ctx.repos, ctx.env);
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Roles bound',
          result.created.length ? `Created ${result.created.join(', ')}` : 'Existing roles were bound. Use `/setup status` for details.'
        )
      ],
      components: panelComponents(),
      files: []
    });
    return;
  }
  if (action === 'verify') {
    const settings = state.settings;
    await interaction.update({
      embeds: [
        embed({
          title: 'Verification',
          description: settings?.verify_channel_id
            ? `Gate channel: <#${settings.verify_channel_id}>\nRun \`/setup verify\` to repost the ✅ panel.`
            : 'No gate yet. Run `/setup verify channel:#verify` — new joins only see that channel until they react ✅.'
        })
      ],
      components: panelComponents(),
      files: []
    });
    return;
  }
  if (action === 'booster') {
    await interaction.update({
      embeds: [
        embed({
          title: 'Boosters',
          description: state.settings?.booster_category_id
            ? `Perk category: <#${state.settings.booster_category_id}>\nBoosters are given the bound Booster role automatically.`
            : 'Run `/setup booster` and pick the booster category. The bot will assign the Booster role when someone boosts.'
        })
      ],
      components: panelComponents(),
      files: []
    });
    return;
  }
  if (action === 'trainee') {
    if (!can(state.rankKeys, CAPABILITIES.VIEW_MOD_QUEUE)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot view the trainee queue.')], ephemeral: true });
      return;
    }
    const rows = await ctx.repos.listRequests(interaction.guild.id, 'pending');
    if (!rows.length) {
      await interaction.update({
        embeds: [successEmbed('Queue empty', 'No pending trainee requests.')],
        components: panelComponents(),
        files: []
      });
      return;
    }
    const latest = rows[0];
    await interaction.update({
      embeds: [
        embed({
          title: `${rows.length} pending`,
          description: rows.slice(0, 10).map((row) => `**#${row.id}** \`${row.action_type}\` by <@${row.requester_id}>`).join('\n')
        }),
        requestEmbed(latest, `<@${latest.requester_id}>`)
      ],
      components: requestComponents(latest.id),
      files: []
    });
    return;
  }
  if (action === 'dashboard') {
    if (!can(state.rankKeys, CAPABILITIES.VIEW_DASHBOARD)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot open the dashboard.')], ephemeral: true });
      return;
    }
    const token = randomToken(32);
    await ctx.repos.createSession({
      tokenHash: sha256(token),
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
    });
    const url = `${ctx.env.dashboardPublicUrl.replace(/\/$/, '')}/auth/magic?token=${token}`;
    await interaction.reply({
      embeds: [successEmbed('Dashboard', `[Open the web GUI](${url})\nExpires in 12 hours.`)],
      ephemeral: true
    });
    return;
  }
  if (action === 'status') {
    await interaction.update({
      embeds: [statusEmbed(state.guild, state.bindings, state.settings, state.rankKeys)],
      components: panelComponents(),
      files: []
    });
  }
}

async function handleAccess(interaction, ctx, parts) {
  const state = await loadGuildState(interaction, ctx.repos);
  const action = parts[0];

  if (action === 'page') {
    const page = Number(parts[1]) || 0;
    await interaction.update(accessBrowserPayload(state.structure, page));
    return;
  }
  if (action === 'pickcat') {
    const category = findCategory(state.structure, interaction.values[0]);
    if (!category) {
      await interaction.reply({ embeds: [errorEmbed('Category not found.')], ephemeral: true });
      return;
    }
    await interaction.update(categoryEditorPayload(category));
    return;
  }
  if (action === 'open') {
    const category = findCategory(state.structure, parts[1]);
    if (!category) {
      await interaction.update(accessBrowserPayload(state.structure, 0));
      return;
    }
    await interaction.update(categoryEditorPayload(category));
    return;
  }
  if (action === 'pickch') {
    const { channel, category } = findChannel(state.structure, interaction.values[0]);
    if (!channel) {
      await interaction.reply({ embeds: [errorEmbed('Channel not found.')], ephemeral: true });
      return;
    }
    await interaction.update(channelEditorPayload(channel, category));
    return;
  }
  if (action === 'setprofile') {
    if (!can(state.rankKeys, CAPABILITIES.MANAGE_ACCESS_CONFIG)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot change access.')], ephemeral: true });
      return;
    }
    const targetType = parts[1];
    const targetId = parts[2];
    const profileKey = interaction.values[0];
    const inherit = targetType === 'channel' && profileKey === 'inherit';
    await ctx.repos.upsertRule(interaction.guild.id, targetType, targetId, {
      profileKey: inherit ? 'inherit' : profileKey,
      inherit
    });
    const fresh = await loadGuildState(interaction, ctx.repos);
    if (targetType === 'category') {
      const category = findCategory(fresh.structure, targetId);
      await interaction.update({
        ...categoryEditorPayload(category),
        content: `Saved **${PROFILES[profileKey]?.label || profileKey}**. Apply to write Discord overwrites.`
      });
      return;
    }
    const found = findChannel(fresh.structure, targetId);
    await interaction.update({
      ...channelEditorPayload(found.channel, found.category),
      content: `Saved **${PROFILES[profileKey]?.label || profileKey}**.`
    });
    return;
  }
  if (action === 'apply' || action === 'applyall') {
    if (!can(state.rankKeys, CAPABILITIES.APPLY_ACCESS)) {
      await interaction.reply({ embeds: [errorEmbed('You cannot apply overwrites.')], ephemeral: true });
      return;
    }
    await interaction.deferUpdate();
    const { plan, summary } = await buildGuildApplyPlan(interaction.guild, ctx.repos);
    let filtered = plan;
    if (action === 'apply') {
      const targetType = parts[1];
      const targetId = parts[2];
      if (targetType === 'category') {
        filtered = plan.filter((item) => item.id === targetId || item.parentId === targetId);
      } else {
        filtered = plan.filter((item) => item.id === targetId);
      }
    }
    const result = await applyPlanToGuild(interaction.guild, filtered);
    await ctx.repos.addAudit(interaction.guild.id, interaction.user.id, 'apply_access', {
      summary,
      filtered: filtered.length,
      errors: result.errors
    });
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Applied to Discord',
          `Wrote overwrites for **${filtered.length}** targets. ${result.errors.length ? `${result.errors.length} errors.` : 'No errors.'}`
        )
      ],
      components: panelComponents()
    });
  }
}

async function handleTraineeButton(interaction, ctx, action, id) {
  const state = await loadGuildState(interaction, ctx.repos);
  if (!can(state.rankKeys, CAPABILITIES.APPROVE_TRAINEE)) {
    await interaction.reply({ embeds: [errorEmbed('Only moderators and above can review requests.')], ephemeral: true });
    return;
  }
  const request = await ctx.repos.getRequest(Number(id));
  if (!request || request.guild_id !== interaction.guild.id || request.status !== 'pending') {
    await interaction.reply({ embeds: [errorEmbed('That request is not pending.')], ephemeral: true });
    return;
  }
  if (action === 'deny') {
    await ctx.repos.reviewRequest(request.id, { status: 'denied', reviewerId: interaction.user.id });
    await interaction.update({
      embeds: [successEmbed('Denied', `Request #${request.id} denied by ${interaction.user.tag}.`)],
      components: []
    });
    return;
  }
  await interaction.deferUpdate();
  const result = await executeModeration(interaction.guild, request);
  await ctx.repos.reviewRequest(request.id, { status: 'approved', reviewerId: interaction.user.id, note: result });
  await interaction.editReply({
    embeds: [successEmbed(`Approved #${request.id}`, result)],
    components: []
  });
}

async function handleVerifyButton(interaction, ctx) {
  const bindings = await ctx.repos.getBindings(interaction.guild.id);
  try {
    const result = await grantNewbie(interaction.member, bindings);
    await interaction.reply({
      embeds: [
        successEmbed(
          result.already ? 'Already verified' : 'You are verified',
          result.already ? 'You already have the Newbie role.' : 'Welcome — you can now see the community channels.'
        )
      ],
      ephemeral: true
    });
  } catch (error) {
    await interaction.reply({ embeds: [errorEmbed(error.message)], ephemeral: true });
  }
}

async function routeInteraction(interaction, ctx) {
  if (interaction.isChatInputCommand()) {
    const command = ctx.commands.get(interaction.commandName);
    if (!command) return;
    await command.execute(interaction, ctx);
    return;
  }

  if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
  const id = interaction.customId || '';
  if (!id.startsWith('rm:')) return;
  const parts = id.split(':').slice(1);
  const ns = parts.shift();

  if (ns === 'panel') {
    await handlePanel(interaction, ctx, parts[0]);
    return;
  }
  if (ns === 'access') {
    await handleAccess(interaction, ctx, parts);
    return;
  }
  if (ns === 'trainee') {
    await handleTraineeButton(interaction, ctx, parts[0], parts[1]);
    return;
  }
  if (ns === 'verify' && parts[0] === 'accept') {
    await handleVerifyButton(interaction, ctx);
  }
}

module.exports = { routeInteraction };
