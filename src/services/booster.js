'use strict';

async function syncBoosterRole(member, bindings, auto = true) {
  if (!auto) return { skipped: true };
  const roleId = bindings.booster;
  if (!roleId) return { skipped: true };
  const isBooster = Boolean(member.premiumSince);
  const hasRole = member.roles.cache.has(roleId);
  if (isBooster && !hasRole) {
    await member.roles.add(roleId, 'Server booster');
    return { added: true };
  }
  if (!isBooster && hasRole) {
    await member.roles.remove(roleId, 'No longer boosting');
    return { removed: true };
  }
  return { unchanged: true };
}

async function syncGuildBoosters(guild, repos) {
  const settings = await repos.getSettings(guild.id);
  if (settings && settings.auto_booster === false) return { skipped: true };
  const bindings = await repos.getBindings(guild.id);
  if (!bindings.booster) return { skipped: true };
  await guild.members.fetch();
  let added = 0;
  let removed = 0;
  for (const member of guild.members.cache.values()) {
    const result = await syncBoosterRole(member, bindings, true);
    if (result.added) added += 1;
    if (result.removed) removed += 1;
  }
  return { added, removed };
}

async function ensureBoosterCategoryProfile(repos, guildId, categoryId) {
  if (!categoryId) return;
  await repos.upsertRule(guildId, 'category', categoryId, { profileKey: 'booster', inherit: false });
}

module.exports = { syncBoosterRole, syncGuildBoosters, ensureBoosterCategoryProfile };
