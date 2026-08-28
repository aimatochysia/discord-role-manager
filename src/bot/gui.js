'use strict';

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');
const { RANKS, RANK_KEYS, hasCapability, CAPABILITIES } = require('../config/ranks');
const { PROFILES, SELECTABLE_PROFILES } = require('../config/profiles');
const { buildStructure } = require('../services/structure');
const { resolveStructureAccess } = require('../services/access');
const { embed, BRAND } = require('../utils/embeds');
const { memberRankKeys } = require('../services/permissions');

async function loadGuildState(interaction, repos) {
  const guild = interaction.guild;
  const bindings = await repos.getBindings(guild.id);
  if (!bindings.unverified) bindings.unverified = guild.id;
  const rules = await repos.getRules(guild.id);
  const custom = await repos.getCustom(guild.id);
  const settings = await repos.getSettings(guild.id);
  const rankKeys = memberRankKeys(interaction.member, bindings, guild.ownerId);
  const structure = resolveStructureAccess(buildStructure(guild), rules, custom);
  return { guild, bindings, rules, custom, settings, rankKeys, structure };
}

function can(rankKeys, capability) {
  return rankKeys.includes('owner') || hasCapability(rankKeys, capability);
}

function panelEmbed(guild, rankKeys) {
  const highest = rankKeys
    .slice()
    .sort((a, b) => (RANKS[b]?.priority || 0) - (RANKS[a]?.priority || 0))[0];
  return embed({
    title: `${guild.name} · Role Manager`,
    description: [
      'Discord channel overwrites do not scale. Pick an **access profile** per category, then sync.',
      '',
      `Your rank: **${RANKS[highest]?.label || 'none'}**`,
      '',
      '• **Access** — who can see / chat',
      '• **Map** — picture of the whole tree',
      '• **Verify** — ✅ gate for new members',
      '• **Boosters** — automatic perk category',
      '• **Trainees** — approval queue'
    ].join('\n')
  });
}

function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rm:panel:access').setLabel('Access manager').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rm:panel:map').setLabel('Server map').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rm:panel:structure').setLabel('Structure').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rm:panel:setup').setLabel('Create / bind roles').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rm:panel:verify').setLabel('Verification').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('rm:panel:booster').setLabel('Boosters').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rm:panel:trainee').setLabel('Trainee queue').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('rm:panel:dashboard').setLabel('Web dashboard').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rm:panel:status').setLabel('Status').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function profileBadge(profileKey, inherit) {
  const profile = PROFILES[profileKey] || PROFILES.hidden;
  return inherit ? `${profile.label} (inherit)` : profile.label;
}

function accessBrowserPayload(structure, page = 0) {
  const pageSize = 20;
  const categories = structure.categories || [];
  const maxPage = Math.max(0, Math.ceil(categories.length / pageSize) - 1);
  const safePage = Math.min(Math.max(page, 0), maxPage);
  const slice = categories.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const lines = slice.map((category, index) => {
    const n = safePage * pageSize + index + 1;
    return `**${n}.** ${category.name} — \`${profileBadge(category.access?.profileKey)}\` · ${category.channels.length} channels`;
  });

  const embedView = embed({
    title: 'Access manager',
    description: lines.join('\n') || 'No categories yet. Create some, then come back.',
    footer: `Page ${safePage + 1}/${maxPage + 1} · pick a category to set view/chat`
  });

  const components = [];
  if (slice.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rm:access:pickcat:${safePage}`)
          .setPlaceholder('Select a category')
          .addOptions(
            slice.map((category) => ({
              label: category.name.slice(0, 100),
              value: category.id,
              description: profileBadge(category.access?.profileKey).slice(0, 100)
            }))
          )
      )
    );
  }
  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rm:access:page:${safePage - 1}`)
        .setLabel('Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage <= 0),
      new ButtonBuilder()
        .setCustomId(`rm:access:page:${safePage + 1}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(safePage >= maxPage),
      new ButtonBuilder().setCustomId('rm:access:applyall').setLabel('Apply all to Discord').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('rm:panel:home').setLabel('Back').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embedView], components };
}

function categoryEditorPayload(category) {
  const channelLines = (category.channels || []).map((channel) => {
    const mark = channel.access?.inherit ? '↳' : '•';
    return `${mark} <#${channel.id}> — \`${profileBadge(channel.access?.profileKey, channel.access?.inherit)}\``;
  });

  const embedView = embed({
    title: `# ${category.name}`,
    description: [
      `Profile: **${profileBadge(category.access?.profileKey)}**`,
      '',
      channelLines.join('\n') || '_No channels in this category._',
      '',
      'Channels inherit the category unless you override them. Apply writes Discord permission overwrites for bound ranks only.'
    ].join('\n')
  });

  const profileOptions = SELECTABLE_PROFILES.filter((profile) => !profile.isInherit)
    .slice(0, 25)
    .map((profile) => ({
      label: profile.label,
      value: profile.key,
      description: profile.description.slice(0, 100)
    }));

  const components = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`rm:access:setprofile:category:${category.id}`)
        .setPlaceholder('Set category profile')
        .addOptions(profileOptions)
    )
  ];

  if (category.channels?.length) {
    components.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rm:access:pickch:${category.id}`)
          .setPlaceholder('Override a channel')
          .addOptions(
            category.channels.slice(0, 25).map((channel) => ({
              label: channel.name.slice(0, 100),
              value: channel.id,
              description: profileBadge(channel.access?.profileKey, channel.access?.inherit).slice(0, 100)
            }))
          )
      )
    );
  }

  components.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rm:access:apply:category:${category.id}`).setLabel('Apply this category').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('rm:panel:access').setLabel('All categories').setStyle(ButtonStyle.Secondary)
    )
  );

  return { embeds: [embedView], components };
}

function channelEditorPayload(channel, category) {
  const embedView = embed({
    title: `# ${channel.name}`,
    description: [
      category ? `Category: **${category.name}**` : 'Uncategorized',
      `Current: **${profileBadge(channel.access?.profileKey, channel.access?.inherit)}**`,
      '',
      'Inherit uses the category profile. Custom is edited in the web dashboard (too many toggles for a mobile Discord menu).'
    ].join('\n')
  });

  const profiles = [
    { label: 'Inherit category', value: 'inherit', description: 'Follow the parent category' },
    ...SELECTABLE_PROFILES.filter((profile) => !profile.isInherit).map((profile) => ({
      label: profile.label,
      value: profile.key,
      description: profile.description.slice(0, 100)
    }))
  ].slice(0, 25);

  return {
    embeds: [embedView],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rm:access:setprofile:channel:${channel.id}`)
          .setPlaceholder('Set channel profile')
          .addOptions(profiles)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rm:access:apply:channel:${channel.id}`).setLabel('Apply this channel').setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(category ? `rm:access:open:${category.id}` : 'rm:panel:access')
          .setLabel('Back')
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function statusEmbed(guild, bindings, settings, rankKeys) {
  const bound = RANK_KEYS.filter((key) => bindings[key]).map((key) => `• **${RANKS[key].label}** — <@&${bindings[key]}>` );
  return embed({
    title: 'Setup status',
    color: BRAND,
    fields: [
      { name: 'Bound ranks', value: bound.join('\n') || '_None yet. Use Create / bind roles._', inline: false },
      {
        name: 'Verification',
        value: settings?.verify_channel_id ? `<#${settings.verify_channel_id}>` : '_Not set_',
        inline: true
      },
      {
        name: 'Booster category',
        value: settings?.booster_category_id ? `<#${settings.booster_category_id}>` : '_Not set_',
        inline: true
      },
      {
        name: 'Your ranks',
        value: rankKeys.map((key) => RANKS[key]?.label || key).join(', ') || 'none',
        inline: false
      }
    ]
  });
}

function findCategory(structure, id) {
  return (structure.categories || []).find((category) => category.id === id) || null;
}

function findChannel(structure, id) {
  for (const category of structure.categories || []) {
    const channel = category.channels.find((item) => item.id === id);
    if (channel) return { channel, category };
  }
  const uncategorized = (structure.uncategorized || []).find((item) => item.id === id);
  if (uncategorized) return { channel: uncategorized, category: null };
  return { channel: null, category: null };
}

module.exports = {
  loadGuildState,
  can,
  panelEmbed,
  panelComponents,
  accessBrowserPayload,
  categoryEditorPayload,
  channelEditorPayload,
  statusEmbed,
  findCategory,
  findChannel,
  CAPABILITIES
};
