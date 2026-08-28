'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ChannelType } = require('discord.js');
const { demoGuild } = require('../fixtures/demo-guild');
const { resolveStructureAccess } = require('../src/services/access');
const { buildApplyPlan, buildChannelOverwrites, permissionBitsFor } = require('../src/services/overwrites');

describe('overwrite builder', () => {
  it('denies send but allows view and reactions on a gate', () => {
    const bits = permissionBitsFor(ChannelType.GuildText, { view: true, send: false });
    assert.equal(bits.allow.ViewChannel, true);
    assert.equal(bits.deny.SendMessages, true);
    assert.equal(bits.allow.AddReactions, true);
  });

  it('maps voice chat to Connect / Speak', () => {
    const bits = permissionBitsFor(ChannelType.GuildVoice, { view: true, send: true });
    assert.equal(bits.allow.Connect, true);
    assert.equal(bits.allow.Speak, true);
  });

  it('maps unverified to @everyone and skips duplicate everyone role', () => {
    const overwrites = buildChannelOverwrites({
      channelType: ChannelType.GuildText,
      resolvedRanks: {
        unverified: { view: false, send: false },
        newbie: { view: true, send: true },
        owner: { view: true, send: true }
      },
      bindings: { unverified: 'guild-id', newbie: 'r-newbie', owner: 'r-owner' },
      everyoneId: 'guild-id'
    });
    assert.equal(overwrites[0].kind, 'everyone');
    assert.equal(overwrites[0].deny.ViewChannel, true);
    const newbie = overwrites.find((item) => item.rankKey === 'newbie');
    assert.equal(newbie.allow.ViewChannel, true);
    assert.equal(newbie.allow.SendMessages, true);
    assert.equal(overwrites.some((item) => item.id === 'guild-id' && item.rankKey === 'unverified' && item.kind === 'role'), false);
  });

  it('builds an apply plan that inherits community channels', () => {
    const demo = demoGuild();
    const resolved = resolveStructureAccess(
      { name: demo.guild.name, categories: demo.categories, uncategorized: demo.uncategorized },
      demo.rules,
      demo.custom
    );
    const plan = buildApplyPlan(resolved, demo.bindings, demo.everyoneId);
    const general = plan.find((item) => item.id === 'ch-general');
    assert.equal(general.inherit, true);
    assert.equal(general.overwrites.length, 0);
    const welcome = plan.find((item) => item.id === 'c-welcome');
    assert.ok(welcome.overwrites.length > 1);
    const everyone = welcome.overwrites.find((item) => item.kind === 'everyone');
    assert.equal(everyone.allow.ViewChannel, true);
    assert.equal(everyone.deny.SendMessages, true);
  });
});
