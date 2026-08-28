'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { RANKS, RANK_KEYS, hasCapability, highestRank, CAPABILITIES } = require('../config/ranks');

function memberRankKeys(member, bindings, ownerId) {
  const keys = new Set();
  if (member.id === ownerId || member.guild?.ownerId === member.id) {
    keys.add('owner');
  }
  for (const key of RANK_KEYS) {
    const roleId = bindings[key];
    if (roleId && member.roles?.cache?.has(roleId)) keys.add(key);
  }
  if (member.premiumSince) keys.add('booster');
  return [...keys];
}

function memberCan(member, bindings, capability, ownerId) {
  const keys = memberRankKeys(member, bindings, ownerId || member.guild?.ownerId);
  if (keys.includes('owner')) return true;
  return hasCapability(keys, capability);
}

function requireCapability(rankKeys, capability) {
  if (rankKeys.includes('owner')) return true;
  return hasCapability(rankKeys, capability);
}

function discordPermissionsForRank(rankKey) {
  const bits = [];
  switch (rankKey) {
    case 'administrator':
      bits.push(
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers,
        PermissionFlagsBits.ManageWebhooks
      );
      break;
    case 'moderator':
      bits.push(
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ModerateMembers,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ViewAuditLog,
        PermissionFlagsBits.MuteMembers,
        PermissionFlagsBits.DeafenMembers,
        PermissionFlagsBits.MoveMembers
      );
      break;
    case 'moderator_trainee':
      bits.push(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads);
      break;
    case 'developer':
      bits.push(PermissionFlagsBits.ViewAuditLog, PermissionFlagsBits.ManageWebhooks);
      break;
    default:
      break;
  }
  return bits.reduce((acc, bit) => acc | bit, 0n);
}

module.exports = {
  memberRankKeys,
  memberCan,
  requireCapability,
  discordPermissionsForRank,
  CAPABILITIES,
  highestRank,
  RANKS
};
