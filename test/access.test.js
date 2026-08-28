'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { demoGuild } = require('../fixtures/demo-guild');
const { resolveStructureAccess, resolveTargetAccess, indexByTarget, indexCustom } = require('../src/services/access');

function resolvedDemo() {
  const demo = demoGuild();
  return resolveStructureAccess(
    {
      id: demo.guild.id,
      name: demo.guild.name,
      categories: demo.categories,
      uncategorized: demo.uncategorized
    },
    demo.rules,
    demo.custom
  );
}

describe('access resolver', () => {
  it('lets unverified members only into the gate category', () => {
    const structure = resolvedDemo();
    const welcome = structure.categories.find((item) => item.id === 'c-welcome');
    assert.equal(welcome.access.ranks.unverified.view, true);
    assert.equal(welcome.access.ranks.unverified.send, false);
    const community = structure.categories.find((item) => item.id === 'c-community');
    assert.equal(community.access.ranks.unverified.view, false);
    assert.equal(community.access.ranks.newbie.view, false);
    assert.equal(community.access.ranks.member.view, true);
  });

  it('inherits category access onto channels by default', () => {
    const structure = resolvedDemo();
    const general = structure.categories.find((item) => item.id === 'c-community').channels.find((item) => item.id === 'ch-general');
    assert.equal(general.access.inherit, true);
    assert.equal(general.access.profileKey, 'member');
    assert.equal(general.access.ranks.member.send, true);
  });

  it('honors per-channel overrides for rules and announcements', () => {
    const structure = resolvedDemo();
    const rules = structure.categories.find((item) => item.id === 'c-welcome').channels.find((item) => item.id === 'ch-rules');
    assert.equal(rules.access.inherit, false);
    assert.equal(rules.access.profileKey, 'info');
    assert.equal(rules.access.ranks.newbie.view, true);
    assert.equal(rules.access.ranks.newbie.send, false);
    assert.equal(rules.access.ranks.unverified.view, false);
  });

  it('always grants owner chat and developer view', () => {
    const structure = resolvedDemo();
    const archive = structure.categories.find((item) => item.id === 'c-archive');
    assert.equal(archive.access.ranks.owner.view, true);
    assert.equal(archive.access.ranks.owner.send, true);
    assert.equal(archive.access.ranks.developer.view, true);
    assert.equal(archive.access.ranks.developer.send, false);
    assert.equal(archive.access.ranks.moderator.view, false);
  });

  it('keeps trainees out of full-moderator rooms', () => {
    const structure = resolvedDemo();
    const mod = structure.categories.find((item) => item.id === 'c-mod');
    assert.equal(mod.access.ranks.moderator_trainee.view, false);
    assert.equal(mod.access.ranks.moderator.view, true);
  });

  it('applies custom per-rank toggles', () => {
    const structure = resolvedDemo();
    const bots = structure.categories.find((item) => item.id === 'c-admin').channels.find((item) => item.id === 'ch-bots');
    assert.equal(bots.access.profileKey, 'custom');
    assert.equal(bots.access.ranks.moderator.view, true);
    assert.equal(bots.access.ranks.moderator.send, false);
    assert.equal(bots.access.ranks.developer.send, true);
  });

  it('uses hidden when an uncategorized channel has no rule', () => {
    const demo = demoGuild();
    const rulesByTarget = indexByTarget(demo.rules);
    const customByTarget = indexCustom(demo.custom);
    const access = resolveTargetAccess({
      targetType: 'channel',
      targetId: 'orphan',
      parentCategoryId: null,
      rulesByTarget,
      customByTarget
    });
    assert.equal(access.profileKey, 'hidden');
    assert.equal(access.ranks.newbie.view, false);
  });
});
