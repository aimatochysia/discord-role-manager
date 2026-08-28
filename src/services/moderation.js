'use strict';

async function executeModeration(guild, request) {
  const payload = request.payload || {};
  const action = request.action_type;
  const reason = payload.reason || `Role Manager ${action}`;
  const target = payload.targetUserId ? await guild.members.fetch(payload.targetUserId).catch(() => null) : null;

  if (['timeout', 'kick', 'ban', 'nick', 'add_role', 'remove_role'].includes(action) && !target) {
    throw new Error('Target member is no longer in the server.');
  }

  switch (action) {
    case 'timeout': {
      const ms = Number(payload.durationMs) || 10 * 60 * 1000;
      await target.timeout(ms, reason);
      return `Timed out ${target.user.tag} for ${Math.round(ms / 60000)} minutes.`;
    }
    case 'kick':
      await target.kick(reason);
      return `Kicked ${target.user.tag}.`;
    case 'ban':
      await target.ban({ reason, deleteMessageSeconds: payload.deleteMessageSeconds || 0 });
      return `Banned ${target.user.tag}.`;
    case 'nick':
      await target.setNickname(payload.nickname || null, reason);
      return `Updated nickname for ${target.user.tag}.`;
    case 'add_role': {
      await target.roles.add(payload.roleId, reason);
      return `Added role to ${target.user.tag}.`;
    }
    case 'remove_role': {
      await target.roles.remove(payload.roleId, reason);
      return `Removed role from ${target.user.tag}.`;
    }
    case 'purge': {
      const channel = guild.channels.cache.get(payload.channelId);
      if (!channel || !channel.bulkDelete) throw new Error('Cannot purge this channel.');
      const deleted = await channel.bulkDelete(Math.min(Number(payload.limit) || 20, 100), true);
      return `Deleted ${deleted.size} messages.`;
    }
    case 'slowmode': {
      const channel = guild.channels.cache.get(payload.channelId);
      if (!channel?.setRateLimitPerUser) throw new Error('Cannot set slowmode here.');
      await channel.setRateLimitPerUser(Number(payload.seconds) || 0, reason);
      return `Slowmode set to ${payload.seconds || 0}s.`;
    }
    default:
      throw new Error(`Unknown action ${action}`);
  }
}

module.exports = { executeModeration };
