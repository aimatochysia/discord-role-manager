'use strict';

const { RANKS, RANK_KEYS } = require('../config/ranks');
const { discordPermissionsForRank } = require('./permissions');

function hexColor(value) {
  return Number.parseInt(String(value).replace('#', ''), 16);
}

async function ensureRanks(guild, repos) {
  const created = [];
  const bindings = await repos.getBindings(guild.id);
  if (!bindings.unverified) {
    await repos.setBinding(guild.id, 'unverified', guild.id);
    bindings.unverified = guild.id;
  }
  if (!bindings.owner) {
    const ownerRole = guild.roles.cache.find((role) => role.name.toLowerCase() === 'owner' && role.editable);
    if (ownerRole) {
      await repos.setBinding(guild.id, 'owner', ownerRole.id);
      bindings.owner = ownerRole.id;
    }
  }

  for (const key of RANK_KEYS) {
    const spec = RANKS[key];
    if (!spec.createRole) continue;
    if (bindings[key] && guild.roles.cache.has(bindings[key])) continue;
    const existing = guild.roles.cache.find((role) => role.name.toLowerCase() === spec.label.toLowerCase());
    if (existing) {
      await repos.setBinding(guild.id, key, existing.id);
      continue;
    }
    const role = await guild.roles.create({
      name: spec.label,
      color: hexColor(spec.color),
      hoist: spec.hoist,
      mentionable: spec.mentionable,
      permissions: discordPermissionsForRank(key),
      reason: 'Role Manager setup'
    });
    await repos.setBinding(guild.id, key, role.id);
    created.push(spec.label);
  }

  await repos.upsertSettings(guild.id, {});
  return { created, bindings: await repos.getBindings(guild.id) };
}

async function seedEnvDefaults(guild, repos, env) {
  const patch = {};
  if (env.verifyChannelId) patch.verify_channel_id = env.verifyChannelId;
  if (env.boosterCategoryId) patch.booster_category_id = env.boosterCategoryId;
  if (env.logChannelId) patch.log_channel_id = env.logChannelId;
  if (Object.keys(patch).length) await repos.upsertSettings(guild.id, patch);
  if (env.newbieRoleId) await repos.setBinding(guild.id, 'newbie', env.newbieRoleId);
}

module.exports = { ensureRanks, seedEnvDefaults };
