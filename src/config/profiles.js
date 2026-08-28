'use strict';

const { RANKS, RANK_KEYS } = require('./ranks');

const NONE = Object.freeze({ view: false, send: false });
const VIEW = Object.freeze({ view: true, send: false });
const CHAT = Object.freeze({ view: true, send: true });

function blank() {
  return Object.fromEntries(RANK_KEYS.map((key) => [key, { ...NONE }]));
}

function setRanks(perms, keys, access) {
  for (const key of keys) {
    if (perms[key]) perms[key] = { ...access };
  }
  return perms;
}

function staffFrom(minPriority, access) {
  return RANK_KEYS.filter((key) => RANKS[key].kind === 'staff' && RANKS[key].priority >= minPriority)
    .reduce((acc, key) => {
      acc[key] = { ...access };
      return acc;
    }, {});
}

function communityFrom(minPriority, access, { includeBooster = true } = {}) {
  const out = {};
  for (const key of RANK_KEYS) {
    const rank = RANKS[key];
    if (rank.kind === 'staff') continue;
    if (rank.key === 'unverified') continue;
    if (rank.key === 'booster' && !includeBooster) continue;
    if (rank.priority >= minPriority) out[key] = { ...access };
  }
  return out;
}

function assemble(groups) {
  const perms = blank();
  for (const group of groups) {
    for (const [key, access] of Object.entries(group)) {
      perms[key] = { ...access };
    }
  }
  return perms;
}

const PROFILES = {
  inherit: {
    key: 'inherit',
    label: 'Inherit category',
    description: 'Use the parent category access. Default for channels.',
    color: '#80848e',
    isInherit: true,
    permissions: blank()
  },
  hidden: {
    key: 'hidden',
    label: 'Hidden',
    description: 'Nobody except owner (and developer view) until you pick a profile.',
    color: '#4e5058',
    permissions: assemble([staffFrom(100, CHAT)])
  },
  gate: {
    key: 'gate',
    label: 'Verification gate',
    description: 'Unverified can see and react, not chat. Staff can help.',
    color: '#23a559',
    permissions: assemble([
      { unverified: { view: true, send: false } },
      staffFrom(30, CHAT)
    ])
  },
  public: {
    key: 'public',
    label: 'Public',
    description: 'Everyone including unverified can view and chat.',
    color: '#f0b232',
    permissions: setRanks(blank(), RANK_KEYS, CHAT)
  },
  info: {
    key: 'info',
    label: 'Read-only info',
    description: 'Verified members can read. Staff can post. Unverified cannot see it.',
    color: '#00a8fc',
    permissions: assemble([
      communityFrom(10, VIEW),
      staffFrom(30, CHAT)
    ])
  },
  newbie: {
    key: 'newbie',
    label: 'Newbie+',
    description: 'Just-verified members and above can chat. The typical community space.',
    color: '#2ecc71',
    permissions: assemble([
      communityFrom(10, CHAT),
      staffFrom(30, CHAT)
    ])
  },
  member: {
    key: 'member',
    label: 'Member+',
    description: 'Hides the channel from newbies. Bind a Member role to use this gate.',
    color: '#3498db',
    permissions: assemble([
      communityFrom(15, CHAT),
      staffFrom(30, CHAT)
    ])
  },
  booster: {
    key: 'booster',
    label: 'Booster perks',
    description: 'Boosters and staff. Automatically used for the booster category.',
    color: '#f47fff',
    permissions: assemble([
      { booster: CHAT },
      staffFrom(30, CHAT)
    ])
  },
  staff: {
    key: 'staff',
    label: 'Staff (trainee+)',
    description: 'Moderator trainees and above.',
    color: '#9b59b6',
    permissions: assemble([staffFrom(30, CHAT)])
  },
  mod: {
    key: 'mod',
    label: 'Moderators',
    description: 'Full moderators and above. Trainees cannot see it.',
    color: '#5865f2',
    permissions: assemble([staffFrom(50, CHAT)])
  },
  admin: {
    key: 'admin',
    label: 'Administrators',
    description: 'Administrators and owner. Developers can still see it via view bypass.',
    color: '#e67e22',
    permissions: assemble([staffFrom(70, CHAT)])
  },
  developer: {
    key: 'developer',
    label: 'Developer',
    description: 'Developer workshop plus owner. Not for player management.',
    color: '#3ba55d',
    permissions: assemble([
      { developer: CHAT },
      { owner: CHAT }
    ])
  },
  owner: {
    key: 'owner',
    label: 'Owner only',
    description: 'Owner rank only.',
    color: '#f23f42',
    permissions: assemble([staffFrom(100, CHAT)])
  },
  custom: {
    key: 'custom',
    label: 'Custom',
    description: 'Per-rank view/chat toggles that you set in the GUI.',
    color: '#ffffff',
    isCustom: true,
    permissions: blank()
  }
};

const PROFILE_KEYS = Object.keys(PROFILES).filter((key) => key !== 'inherit');

const SELECTABLE_PROFILES = Object.values(PROFILES);

function getProfile(key) {
  return PROFILES[key] || null;
}

function clonePermissions(permissions) {
  return Object.fromEntries(
    Object.entries(permissions).map(([key, value]) => [key, { view: !!value.view, send: !!value.send }])
  );
}

module.exports = {
  NONE,
  VIEW,
  CHAT,
  PROFILES,
  PROFILE_KEYS,
  SELECTABLE_PROFILES,
  getProfile,
  clonePermissions,
  blankPermissions: blank
};
