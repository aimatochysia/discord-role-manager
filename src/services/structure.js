'use strict';

const { ChannelType } = require('discord.js');

function serializeChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.rawPosition ?? channel.position ?? 0,
    parentId: channel.parentId || null
  };
}

function buildStructure(guild) {
  const categories = [...guild.channels.cache.filter((channel) => channel.type === ChannelType.GuildCategory).values()]
    .sort((a, b) => a.position - b.position)
    .map((category) => ({
      id: category.id,
      name: category.name,
      position: category.position,
      channels: [...guild.channels.cache.filter((channel) => channel.parentId === category.id).values()]
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
        .map(serializeChannel)
    }));

  const uncategorized = [...guild.channels.cache.filter((channel) => {
    return channel.type !== ChannelType.GuildCategory && !channel.parentId;
  }).values()]
    .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
    .map(serializeChannel);

  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 64 }),
    memberCount: guild.memberCount,
    ownerId: guild.ownerId,
    categories,
    uncategorized
  };
}

function findChannel(guild, id) {
  return guild.channels.cache.get(id) || null;
}

module.exports = { buildStructure, serializeChannel, findChannel };
