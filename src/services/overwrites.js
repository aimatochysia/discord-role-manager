'use strict';

const { ChannelType, PermissionFlagsBits } = require('discord.js');

const TEXTISH = new Set([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia
]);

const VOICEISH = new Set([
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice
]);

function isTextish(type) {
  return TEXTISH.has(type) || type === 'text' || type === 'announcement' || type === 'forum' || type === 'media';
}

function isVoiceish(type) {
  return VOICEISH.has(type) || type === 'voice' || type === 'stage';
}

function permissionBitsFor(type, { view, send }) {
  const allow = {};
  const deny = {};

  const set = (flag, enabled) => {
    const name = permissionName(flag);
    if (enabled) allow[name] = true;
    else deny[name] = true;
  };

  if (!view) {
    set(PermissionFlagsBits.ViewChannel, false);
    return { allow, deny };
  }

  set(PermissionFlagsBits.ViewChannel, true);
  set(PermissionFlagsBits.ReadMessageHistory, true);

  if (isVoiceish(type)) {
    set(PermissionFlagsBits.Connect, true);
    set(PermissionFlagsBits.Speak, send);
    set(PermissionFlagsBits.Stream, send);
    set(PermissionFlagsBits.UseVAD, send);
    return { allow, deny };
  }

  set(PermissionFlagsBits.SendMessages, send);
  set(PermissionFlagsBits.EmbedLinks, send);
  set(PermissionFlagsBits.AttachFiles, send);
  set(PermissionFlagsBits.UseExternalEmojis, send);
  set(PermissionFlagsBits.AddReactions, true);
  set(PermissionFlagsBits.SendMessagesInThreads, send);
  set(PermissionFlagsBits.CreatePublicThreads, send);
  return { allow, deny };
}

function permissionName(bit) {
  for (const [name, value] of Object.entries(PermissionFlagsBits)) {
    if (value === bit) return name;
  }
  return String(bit);
}

function overwriteForRole(roleId, access, channelType, meta = {}) {
  const { allow, deny } = permissionBitsFor(channelType, access);
  return {
    id: roleId,
    allow,
    deny,
    rankKey: meta.rankKey || null,
    kind: meta.kind || 'role'
  };
}

function overwriteForEveryone(everyoneId, access, channelType) {
  return overwriteForRole(everyoneId, access, channelType, { rankKey: 'unverified', kind: 'everyone' });
}

/**
 * Build Discord overwrite payloads for one channel from resolved access + role bindings.
 * Unverified maps to @everyone (guild id) unless a dedicated role is bound and
 * `dedicatedUnverified` is true.
 */
function buildChannelOverwrites({
  channelType,
  resolvedRanks,
  bindings,
  everyoneId,
  dedicatedUnverified = false
}) {
  const overwrites = [];
  const unverified = resolvedRanks.unverified || { view: false, send: false };
  overwrites.push(overwriteForEveryone(everyoneId, unverified, channelType));

  for (const [rankKey, access] of Object.entries(resolvedRanks)) {
    if (rankKey === 'unverified' && !dedicatedUnverified) continue;
    const roleId = bindings[rankKey];
    if (!roleId || roleId === everyoneId) continue;
    overwrites.push(overwriteForRole(roleId, access, channelType, { rankKey, kind: 'role' }));
  }
  return overwrites;
}

function buildApplyPlan(resolvedStructure, bindings, everyoneId) {
  const plan = [];

  for (const category of resolvedStructure.categories || []) {
    plan.push({
      id: category.id,
      name: category.name,
      type: ChannelType.GuildCategory,
      kind: 'category',
      inherit: false,
      profileKey: category.access?.profileKey,
      overwrites: buildChannelOverwrites({
        channelType: ChannelType.GuildCategory,
        resolvedRanks: category.access?.ranks || {},
        bindings,
        everyoneId
      })
    });
    for (const channel of category.channels || []) {
      plan.push({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        kind: 'channel',
        parentId: category.id,
        inherit: Boolean(channel.access?.inherit),
        profileKey: channel.access?.profileKey,
        overwrites: channel.access?.inherit
          ? []
          : buildChannelOverwrites({
              channelType: channel.type,
              resolvedRanks: channel.access?.ranks || {},
              bindings,
              everyoneId
            })
      });
    }
  }

  for (const channel of resolvedStructure.uncategorized || []) {
    plan.push({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      kind: 'channel',
      parentId: null,
      inherit: false,
      profileKey: channel.access?.profileKey,
      overwrites: buildChannelOverwrites({
        channelType: channel.type,
        resolvedRanks: channel.access?.ranks || {},
        bindings,
        everyoneId
      })
    });
  }

  return plan;
}

function summarizePlan(plan) {
  return {
    targets: plan.length,
    inherited: plan.filter((item) => item.inherit).length,
    explicit: plan.filter((item) => !item.inherit).length
  };
}

module.exports = {
  TEXTISH,
  VOICEISH,
  isTextish,
  isVoiceish,
  permissionBitsFor,
  overwriteForRole,
  overwriteForEveryone,
  buildChannelOverwrites,
  buildApplyPlan,
  summarizePlan
};
