'use strict';

const { RANKS, RANK_KEYS } = require('../src/config/ranks');
const { PROFILES } = require('../src/config/profiles');

function demoGuild() {
  const bindings = {
    owner: 'r-owner',
    developer: 'r-developer',
    administrator: 'r-administrator',
    moderator: 'r-moderator',
    moderator_trainee: 'r-trainee',
    booster: 'r-booster',
    member: 'r-member',
    newbie: 'r-newbie',
    unverified: 'g-aether'
  };

  const roles = [
    { id: 'g-aether', name: '@everyone', color: '#99aab5' },
    { id: 'r-owner', name: 'Owner', color: RANKS.owner.color },
    { id: 'r-developer', name: 'Developer', color: RANKS.developer.color },
    { id: 'r-administrator', name: 'Administrator', color: RANKS.administrator.color },
    { id: 'r-moderator', name: 'Moderator', color: RANKS.moderator.color },
    { id: 'r-trainee', name: 'Moderator Trainee', color: RANKS.moderator_trainee.color },
    { id: 'r-booster', name: 'Booster', color: RANKS.booster.color },
    { id: 'r-member', name: 'Member', color: RANKS.member.color },
    { id: 'r-newbie', name: 'Newbie', color: RANKS.newbie.color }
  ];

  const categories = [
    {
      id: 'c-welcome',
      name: 'WELCOME',
      position: 0,
      channels: [
        { id: 'ch-verify', name: 'verify', type: 0, position: 0 },
        { id: 'ch-rules', name: 'rules', type: 0, position: 1 },
        { id: 'ch-announce', name: 'announcements', type: 5, position: 2 }
      ]
    },
    {
      id: 'c-newcomers',
      name: 'NEWCOMERS',
      position: 1,
      channels: [
        { id: 'ch-intro', name: 'introductions', type: 0, position: 0 },
        { id: 'ch-questions', name: 'questions', type: 0, position: 1 }
      ]
    },
    {
      id: 'c-community',
      name: 'COMMUNITY',
      position: 2,
      channels: [
        { id: 'ch-general', name: 'general', type: 0, position: 0 },
        { id: 'ch-media', name: 'media', type: 0, position: 1 },
        { id: 'ch-games', name: 'games', type: 0, position: 2 },
        { id: 'ch-forum', name: 'topics', type: 15, position: 3 }
      ]
    },
    {
      id: 'c-voice',
      name: 'VOICE',
      position: 3,
      channels: [
        { id: 'ch-lounge', name: 'Lounge', type: 2, position: 0 },
        { id: 'ch-music', name: 'Music', type: 2, position: 1 },
        { id: 'ch-stage', name: 'Town Hall', type: 13, position: 2 }
      ]
    },
    {
      id: 'c-booster',
      name: 'BOOSTER PERKS',
      position: 4,
      channels: [
        { id: 'ch-boost-chat', name: 'booster-lounge', type: 0, position: 0 },
        { id: 'ch-boost-vc', name: 'Booster VC', type: 2, position: 1 }
      ]
    },
    {
      id: 'c-staff',
      name: 'STAFF',
      position: 5,
      channels: [
        { id: 'ch-staff-chat', name: 'staff-chat', type: 0, position: 0 },
        { id: 'ch-staff-log', name: 'mod-log', type: 0, position: 1 }
      ]
    },
    {
      id: 'c-mod',
      name: 'MODERATION',
      position: 6,
      channels: [
        { id: 'ch-cases', name: 'cases', type: 0, position: 0 },
        { id: 'ch-queue', name: 'trainee-queue', type: 0, position: 1 }
      ]
    },
    {
      id: 'c-admin',
      name: 'ADMIN',
      position: 7,
      channels: [
        { id: 'ch-admin', name: 'admin-only', type: 0, position: 0 },
        { id: 'ch-bots', name: 'bot-commands', type: 0, position: 1 }
      ]
    },
    {
      id: 'c-dev',
      name: 'DEVELOPER',
      position: 8,
      channels: [
        { id: 'ch-dev', name: 'bot-workshop', type: 0, position: 0 },
        { id: 'ch-status', name: 'service-status', type: 0, position: 1 }
      ]
    },
    {
      id: 'c-archive',
      name: 'ARCHIVE',
      position: 9,
      channels: [
        { id: 'ch-old', name: 'old-events', type: 0, position: 0 }
      ]
    }
  ];

  const rules = [
    { target_type: 'category', target_id: 'c-welcome', profile_key: 'gate', inherit: false },
    { target_type: 'channel', target_id: 'ch-rules', profile_key: 'info', inherit: false },
    { target_type: 'channel', target_id: 'ch-announce', profile_key: 'info', inherit: false },
    { target_type: 'category', target_id: 'c-newcomers', profile_key: 'newbie', inherit: false },
    { target_type: 'category', target_id: 'c-community', profile_key: 'member', inherit: false },
    { target_type: 'category', target_id: 'c-voice', profile_key: 'newbie', inherit: false },
    { target_type: 'category', target_id: 'c-booster', profile_key: 'booster', inherit: false },
    { target_type: 'category', target_id: 'c-staff', profile_key: 'staff', inherit: false },
    { target_type: 'category', target_id: 'c-mod', profile_key: 'mod', inherit: false },
    { target_type: 'category', target_id: 'c-admin', profile_key: 'admin', inherit: false },
    { target_type: 'category', target_id: 'c-dev', profile_key: 'developer', inherit: false },
    { target_type: 'category', target_id: 'c-archive', profile_key: 'hidden', inherit: false },
    {
      target_type: 'channel',
      target_id: 'ch-bots',
      profile_key: 'custom',
      inherit: false
    }
  ];

  const custom = [
    { target_type: 'channel', target_id: 'ch-bots', rank_key: 'developer', can_view: true, can_send: true },
    { target_type: 'channel', target_id: 'ch-bots', rank_key: 'administrator', can_view: true, can_send: true },
    { target_type: 'channel', target_id: 'ch-bots', rank_key: 'moderator', can_view: true, can_send: false },
    { target_type: 'channel', target_id: 'ch-bots', rank_key: 'owner', can_view: true, can_send: true }
  ];

  const settings = {
    guild_id: 'g-aether',
    verify_channel_id: 'ch-verify',
    verify_message_id: 'm-verify',
    booster_category_id: 'c-booster',
    log_channel_id: 'ch-staff-log',
    lockdown_unverified: true,
    auto_booster: true
  };

  const requests = [
    {
      id: 1,
      guild_id: 'g-aether',
      requester_id: 'u-trainee',
      requester_tag: 'mira.trainee',
      action_type: 'timeout',
      payload: { targetUserId: 'u-player', targetTag: 'noisy#1042', durationMs: 600000, reason: 'spam in general' },
      status: 'pending',
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      guild_id: 'g-aether',
      requester_id: 'u-trainee',
      requester_tag: 'mira.trainee',
      action_type: 'kick',
      payload: { targetUserId: 'u-raider', targetTag: 'raid-bot', reason: 'joined and mass-pinged' },
      status: 'pending',
      created_at: new Date().toISOString()
    }
  ];

  const audit = [
    { id: 1, actor: 'petra', action: 'apply_access', details: { targets: 24 }, created_at: new Date().toISOString() },
    { id: 2, actor: 'petra', action: 'setup_roles', details: { created: 7 }, created_at: new Date().toISOString() }
  ];

  return {
    guild: { id: 'g-aether', name: 'Aether', icon: null, memberCount: 1284, ownerId: 'u-owner' },
    everyoneId: 'g-aether',
    roles,
    bindings,
    categories,
    uncategorized: [],
    rules,
    custom,
    settings,
    requests,
    audit,
    profiles: Object.values(PROFILES).map((profile) => ({
      key: profile.key,
      label: profile.label,
      description: profile.description,
      color: profile.color
    })),
    ranks: RANK_KEYS.map((key) => ({
      key,
      label: RANKS[key].label,
      description: RANKS[key].description,
      color: RANKS[key].color,
      kind: RANKS[key].kind,
      priority: RANKS[key].priority
    }))
  };
}

module.exports = { demoGuild };
