'use strict';

/**
 * Staff and community ranks the bot understands.
 *
 * Discord's Administrator flag bypasses channel overwrites, which would make
 * the access matrix useless. Bot-managed roles therefore use granular
 * permissions instead. The guild owner user always counts as rank `owner`.
 */

const CAPABILITIES = {
  VIEW_STRUCTURE: 'view_structure',
  VIEW_DASHBOARD: 'view_dashboard',
  GENERATE_MAP: 'generate_map',
  VIEW_AUDIT: 'view_audit',
  MANAGE_ACCESS_CONFIG: 'manage_access_config',
  APPLY_ACCESS: 'apply_access',
  MANAGE_VERIFICATION: 'manage_verification',
  MANAGE_BOT_SETTINGS: 'manage_bot_settings',
  MANAGE_CHANNELS: 'manage_channels',
  MANAGE_CATEGORIES: 'manage_categories',
  ASSIGN_MODERATOR: 'assign_moderator',
  ASSIGN_TRAINEE: 'assign_trainee',
  ASSIGN_ADMIN: 'assign_admin',
  ASSIGN_DEVELOPER: 'assign_developer',
  MANAGE_MESSAGES: 'manage_messages',
  MODERATE_MEMBERS: 'moderate_members',
  KICK_MEMBERS: 'kick_members',
  BAN_MEMBERS: 'ban_members',
  APPROVE_TRAINEE: 'approve_trainee',
  REQUEST_MODERATION: 'request_moderation',
  VIEW_MOD_QUEUE: 'view_mod_queue'
};

const ALL_CAPABILITIES = Object.values(CAPABILITIES);

const RANKS = {
  owner: {
    key: 'owner',
    label: 'Owner',
    description: 'Full control. Always sees and can chat in every managed channel.',
    priority: 100,
    kind: 'staff',
    color: '#f23f42',
    hoist: true,
    mentionable: false,
    bypassView: true,
    bypassSend: true,
    createRole: false,
    capabilities: new Set(ALL_CAPABILITIES)
  },
  developer: {
    key: 'developer',
    label: 'Developer',
    description: 'Technical access for the other bot / integrations. Cannot moderate players.',
    priority: 80,
    kind: 'staff',
    color: '#3ba55d',
    hoist: true,
    mentionable: false,
    bypassView: true,
    bypassSend: false,
    createRole: true,
    capabilities: new Set([
      CAPABILITIES.VIEW_STRUCTURE,
      CAPABILITIES.VIEW_DASHBOARD,
      CAPABILITIES.GENERATE_MAP,
      CAPABILITIES.VIEW_AUDIT,
      CAPABILITIES.MANAGE_ACCESS_CONFIG,
      CAPABILITIES.APPLY_ACCESS,
      CAPABILITIES.MANAGE_VERIFICATION,
      CAPABILITIES.MANAGE_BOT_SETTINGS
    ])
  },
  administrator: {
    key: 'administrator',
    label: 'Administrator',
    description: 'Create/move channels and categories, manage moderators, apply access, moderate members.',
    priority: 70,
    kind: 'staff',
    color: '#e67e22',
    hoist: true,
    mentionable: true,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set([
      CAPABILITIES.VIEW_STRUCTURE,
      CAPABILITIES.VIEW_DASHBOARD,
      CAPABILITIES.GENERATE_MAP,
      CAPABILITIES.VIEW_AUDIT,
      CAPABILITIES.MANAGE_ACCESS_CONFIG,
      CAPABILITIES.APPLY_ACCESS,
      CAPABILITIES.MANAGE_VERIFICATION,
      CAPABILITIES.MANAGE_CHANNELS,
      CAPABILITIES.MANAGE_CATEGORIES,
      CAPABILITIES.ASSIGN_MODERATOR,
      CAPABILITIES.ASSIGN_TRAINEE,
      CAPABILITIES.MANAGE_MESSAGES,
      CAPABILITIES.MODERATE_MEMBERS,
      CAPABILITIES.KICK_MEMBERS,
      CAPABILITIES.BAN_MEMBERS,
      CAPABILITIES.APPROVE_TRAINEE,
      CAPABILITIES.VIEW_MOD_QUEUE
    ])
  },
  moderator: {
    key: 'moderator',
    label: 'Moderator',
    description: 'Manage chat and members. Approves trainee requests.',
    priority: 50,
    kind: 'staff',
    color: '#5865f2',
    hoist: true,
    mentionable: true,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set([
      CAPABILITIES.VIEW_STRUCTURE,
      CAPABILITIES.VIEW_DASHBOARD,
      CAPABILITIES.GENERATE_MAP,
      CAPABILITIES.MANAGE_MESSAGES,
      CAPABILITIES.MODERATE_MEMBERS,
      CAPABILITIES.KICK_MEMBERS,
      CAPABILITIES.APPROVE_TRAINEE,
      CAPABILITIES.VIEW_MOD_QUEUE
    ])
  },
  moderator_trainee: {
    key: 'moderator_trainee',
    label: 'Moderator Trainee',
    description: 'May manage chat immediately. Member actions require moderator approval.',
    priority: 30,
    kind: 'staff',
    color: '#9b59b6',
    hoist: true,
    mentionable: true,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set([
      CAPABILITIES.MANAGE_MESSAGES,
      CAPABILITIES.REQUEST_MODERATION,
      CAPABILITIES.VIEW_MOD_QUEUE
    ])
  },
  booster: {
    key: 'booster',
    label: 'Booster',
    description: 'Automatic Nitro boost perk role. Grants the booster category.',
    priority: 20,
    kind: 'perk',
    color: '#f47fff',
    hoist: true,
    mentionable: false,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set()
  },
  member: {
    key: 'member',
    label: 'Member',
    description: 'Graduated community member. Optional second gate after newbie.',
    priority: 15,
    kind: 'community',
    color: '#3498db',
    hoist: false,
    mentionable: false,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set()
  },
  newbie: {
    key: 'newbie',
    label: 'Newbie',
    description: 'Granted after reacting ✅ in the verification channel.',
    priority: 10,
    kind: 'community',
    color: '#2ecc71',
    hoist: false,
    mentionable: false,
    bypassView: false,
    bypassSend: false,
    createRole: true,
    capabilities: new Set()
  },
  unverified: {
    key: 'unverified',
    label: 'Unverified',
    description: 'Default for brand-new joins. Mapped to @everyone unless you bind a dedicated role.',
    priority: 0,
    kind: 'community',
    color: '#95a5a6',
    hoist: false,
    mentionable: false,
    bypassView: false,
    bypassSend: false,
    createRole: false,
    mapsToEveryone: true,
    capabilities: new Set()
  }
};

const RANK_KEYS = Object.keys(RANKS);

const STAFF_KEYS = RANK_KEYS.filter((key) => RANKS[key].kind === 'staff');

function getRank(key) {
  return RANKS[key] || null;
}

function comparePriority(a, b) {
  return (RANKS[b]?.priority || 0) - (RANKS[a]?.priority || 0);
}

function highestRank(rankKeys) {
  return [...rankKeys].sort(comparePriority)[0] || null;
}

function hasCapability(rankKeys, capability) {
  for (const key of rankKeys) {
    const rank = RANKS[key];
    if (rank?.capabilities.has(capability)) return true;
  }
  return false;
}

/**
 * Whether a staff member may assign `targetRankKey` to someone else.
 * You may only assign ranks strictly below your highest staff rank,
 * plus the extra assign_* capabilities.
 */
function canAssignRank(actorRankKeys, targetRankKey) {
  const target = RANKS[targetRankKey];
  if (!target) return false;
  if (target.key === 'owner') return false;
  const actorBest = highestRank(actorRankKeys.filter((k) => RANKS[k]?.kind === 'staff'));
  if (!actorBest) return false;
  if (RANKS[actorBest].priority <= target.priority) return false;
  if (target.key === 'developer') return hasCapability(actorRankKeys, CAPABILITIES.ASSIGN_DEVELOPER);
  if (target.key === 'administrator') return hasCapability(actorRankKeys, CAPABILITIES.ASSIGN_ADMIN);
  if (target.key === 'moderator') return hasCapability(actorRankKeys, CAPABILITIES.ASSIGN_MODERATOR);
  if (target.key === 'moderator_trainee') return hasCapability(actorRankKeys, CAPABILITIES.ASSIGN_TRAINEE);
  if (target.kind !== 'staff') {
    return hasCapability(actorRankKeys, CAPABILITIES.MODERATE_MEMBERS);
  }
  return false;
}

const DIRECT_ACTIONS = {
  purge: CAPABILITIES.MANAGE_MESSAGES,
  slowmode: CAPABILITIES.MANAGE_MESSAGES,
  pin: CAPABILITIES.MANAGE_MESSAGES
};

const PLAYER_ACTIONS = {
  timeout: CAPABILITIES.MODERATE_MEMBERS,
  kick: CAPABILITIES.KICK_MEMBERS,
  ban: CAPABILITIES.BAN_MEMBERS,
  nick: CAPABILITIES.MODERATE_MEMBERS,
  add_role: CAPABILITIES.MODERATE_MEMBERS,
  remove_role: CAPABILITIES.MODERATE_MEMBERS
};

/**
 * @returns {'allow' | 'deny' | 'request'}
 */
function authorizeAction(rankKeys, action) {
  if (DIRECT_ACTIONS[action]) {
    return hasCapability(rankKeys, DIRECT_ACTIONS[action]) ? 'allow' : 'deny';
  }
  if (PLAYER_ACTIONS[action]) {
    if (hasCapability(rankKeys, PLAYER_ACTIONS[action])) return 'allow';
    if (hasCapability(rankKeys, CAPABILITIES.REQUEST_MODERATION) && action !== 'ban') {
      return 'request';
    }
    return 'deny';
  }
  return 'deny';
}

module.exports = {
  CAPABILITIES,
  ALL_CAPABILITIES,
  RANKS,
  RANK_KEYS,
  STAFF_KEYS,
  getRank,
  comparePriority,
  highestRank,
  hasCapability,
  canAssignRank,
  authorizeAction,
  DIRECT_ACTIONS,
  PLAYER_ACTIONS
};
