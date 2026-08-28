'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  authorizeAction,
  canAssignRank,
  hasCapability,
  CAPABILITIES,
  highestRank
} = require('../src/config/ranks');

describe('rank capabilities', () => {
  it('lets trainees manage chat but not members', () => {
    const trainee = ['moderator_trainee'];
    assert.equal(authorizeAction(trainee, 'purge'), 'allow');
    assert.equal(authorizeAction(trainee, 'slowmode'), 'allow');
    assert.equal(authorizeAction(trainee, 'timeout'), 'request');
    assert.equal(authorizeAction(trainee, 'kick'), 'request');
    assert.equal(authorizeAction(trainee, 'ban'), 'deny');
  });

  it('blocks developers from moderating players', () => {
    const developer = ['developer'];
    assert.equal(authorizeAction(developer, 'timeout'), 'deny');
    assert.equal(authorizeAction(developer, 'kick'), 'deny');
    assert.equal(authorizeAction(developer, 'purge'), 'deny');
    assert.equal(hasCapability(developer, CAPABILITIES.MANAGE_ACCESS_CONFIG), true);
    assert.equal(hasCapability(developer, CAPABILITIES.MODERATE_MEMBERS), false);
  });

  it('lets moderators act on members but not ban', () => {
    const moderator = ['moderator'];
    assert.equal(authorizeAction(moderator, 'timeout'), 'allow');
    assert.equal(authorizeAction(moderator, 'kick'), 'allow');
    assert.equal(authorizeAction(moderator, 'ban'), 'deny');
    assert.equal(authorizeAction(moderator, 'purge'), 'allow');
  });

  it('lets administrators ban and manage channels', () => {
    const admin = ['administrator'];
    assert.equal(authorizeAction(admin, 'ban'), 'allow');
    assert.equal(hasCapability(admin, CAPABILITIES.MANAGE_CHANNELS), true);
    assert.equal(hasCapability(admin, CAPABILITIES.ASSIGN_MODERATOR), true);
    assert.equal(hasCapability(admin, CAPABILITIES.ASSIGN_DEVELOPER), false);
  });

  it('prevents assigning equal or higher staff ranks', () => {
    assert.equal(canAssignRank(['administrator'], 'moderator'), true);
    assert.equal(canAssignRank(['administrator'], 'moderator_trainee'), true);
    assert.equal(canAssignRank(['administrator'], 'administrator'), false);
    assert.equal(canAssignRank(['administrator'], 'developer'), false);
    assert.equal(canAssignRank(['moderator'], 'moderator_trainee'), false);
    assert.equal(canAssignRank(['owner'], 'developer'), true);
  });

  it('picks the highest rank', () => {
    assert.equal(highestRank(['newbie', 'moderator', 'booster']), 'moderator');
  });
});
