'use strict';

const { RANKS, RANK_KEYS } = require('../config/ranks');
const { PROFILES, clonePermissions, blankPermissions } = require('../config/profiles');

function targetKey(type, id) {
  return `${type}:${id}`;
}

function indexByTarget(rows, typeField = 'target_type', idField = 'target_id') {
  const map = new Map();
  for (const row of rows || []) {
    map.set(targetKey(row[typeField], row[idField]), row);
  }
  return map;
}

function indexCustom(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = targetKey(row.target_type, row.target_id);
    if (!map.has(key)) map.set(key, {});
    map.get(key)[row.rank_key] = row;
  }
  return map;
}

function applyBypass(permissions) {
  const out = blankPermissions();
  for (const key of RANK_KEYS) {
    const rank = RANKS[key];
    const current = permissions[key] || { view: false, send: false };
    const view = Boolean(current.view || rank.bypassView);
    const send = Boolean(view && (current.send || rank.bypassSend));
    out[key] = { view, send };
  }
  return out;
}

function resolveFromProfile(profileKey, customRanks) {
  if (profileKey === 'custom') {
    const perms = blankPermissions();
    for (const [rankKey, row] of Object.entries(customRanks || {})) {
      if (!perms[rankKey]) continue;
      perms[rankKey] = {
        view: Boolean(row.can_view ?? row.view),
        send: Boolean(row.can_send ?? row.send)
      };
    }
    return { profileKey: 'custom', ranks: applyBypass(perms) };
  }
  const profile = PROFILES[profileKey] || PROFILES.hidden;
  return {
    profileKey: profile.key,
    ranks: applyBypass(clonePermissions(profile.permissions))
  };
}

/**
 * Resolve who can view/send a category or channel.
 *
 * Channels inherit the parent category unless their rule has inherit=false
 * and a non-inherit profile (including custom).
 */
function resolveTargetAccess({
  targetType,
  targetId,
  parentCategoryId = null,
  rulesByTarget,
  customByTarget
}) {
  const key = targetKey(targetType, targetId);
  const rule = rulesByTarget.get(key);

  if (targetType === 'channel') {
    const shouldInherit = !rule || rule.inherit !== false || rule.profile_key === 'inherit' || !rule.profile_key;
    if (shouldInherit) {
      if (!parentCategoryId) {
        const resolved = resolveFromProfile('hidden', null);
        return { ...resolved, inherit: true, inheritedFrom: null };
      }
      const parent = resolveTargetAccess({
        targetType: 'category',
        targetId: parentCategoryId,
        parentCategoryId: null,
        rulesByTarget,
        customByTarget
      });
      return {
        ...parent,
        inherit: true,
        inheritedFrom: parentCategoryId
      };
    }
  }

  const profileKey = rule?.profile_key || (targetType === 'category' ? 'hidden' : 'inherit');
  if (profileKey === 'inherit' && targetType === 'category') {
    const resolved = resolveFromProfile('hidden', null);
    return { ...resolved, inherit: false, inheritedFrom: null };
  }

  const custom = customByTarget.get(key) || {};
  const resolved = resolveFromProfile(profileKey, custom);
  return {
    ...resolved,
    inherit: false,
    inheritedFrom: null
  };
}

function resolveStructureAccess(structure, rules, customRows) {
  const rulesByTarget = rules instanceof Map ? rules : indexByTarget(rules);
  const customByTarget = customRows instanceof Map ? customRows : indexCustom(customRows);
  const categories = (structure.categories || []).map((category) => {
    const access = resolveTargetAccess({
      targetType: 'category',
      targetId: category.id,
      rulesByTarget,
      customByTarget
    });
    const channels = (category.channels || []).map((channel) => {
      const channelAccess = resolveTargetAccess({
        targetType: 'channel',
        targetId: channel.id,
        parentCategoryId: category.id,
        rulesByTarget,
        customByTarget
      });
      return { ...channel, access: channelAccess };
    });
    return { ...category, access, channels };
  });

  const uncategorized = (structure.uncategorized || []).map((channel) => {
    const access = resolveTargetAccess({
      targetType: 'channel',
      targetId: channel.id,
      parentCategoryId: null,
      rulesByTarget,
      customByTarget
    });
    return { ...channel, access };
  });

  return { ...structure, categories, uncategorized };
}

function flattenChannels(structure) {
  const list = [];
  for (const category of structure.categories || []) {
    for (const channel of category.channels || []) {
      list.push({ ...channel, categoryId: category.id, categoryName: category.name });
    }
  }
  for (const channel of structure.uncategorized || []) {
    list.push({ ...channel, categoryId: null, categoryName: null });
  }
  return list;
}

module.exports = {
  targetKey,
  indexByTarget,
  indexCustom,
  applyBypass,
  resolveFromProfile,
  resolveTargetAccess,
  resolveStructureAccess,
  flattenChannels
};
