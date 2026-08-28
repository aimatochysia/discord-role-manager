'use strict';

const { buildStructure } = require('./structure');
const { resolveStructureAccess } = require('./access');
const { buildApplyPlan, summarizePlan } = require('./overwrites');

async function applyOverwrite(channel, overwrite) {
  const flags = {};
  for (const [name, value] of Object.entries(overwrite.allow || {})) flags[name] = value;
  for (const [name, value] of Object.entries(overwrite.deny || {})) flags[name] = value;
  await channel.permissionOverwrites.edit(overwrite.id, flags, { reason: 'Role Manager access sync' });
}

async function applyPlanToGuild(guild, plan, { onProgress } = {}) {
  let done = 0;
  const errors = [];
  for (const item of plan) {
    const channel = guild.channels.cache.get(item.id);
    done += 1;
    if (onProgress) onProgress({ done, total: plan.length, item });
    if (!channel) {
      errors.push({ id: item.id, name: item.name, error: 'Channel not found' });
      continue;
    }
    try {
      if (item.inherit && item.parentId) {
        await channel.lockPermissions();
        continue;
      }
      for (const overwrite of item.overwrites) {
        await applyOverwrite(channel, overwrite);
      }
    } catch (error) {
      errors.push({ id: item.id, name: item.name, error: error.message });
    }
  }
  return { done, errors };
}

async function buildGuildApplyPlan(guild, repos) {
  const [bindings, rules, custom] = await Promise.all([
    repos.getBindings(guild.id),
    repos.getRules(guild.id),
    repos.getCustom(guild.id)
  ]);
  if (!bindings.unverified) bindings.unverified = guild.id;
  const structure = buildStructure(guild);
  const resolved = resolveStructureAccess(structure, rules, custom);
  const plan = buildApplyPlan(resolved, bindings, guild.id);
  return { structure: resolved, plan, summary: summarizePlan(plan), bindings };
}

module.exports = { applyOverwrite, applyPlanToGuild, buildGuildApplyPlan };
