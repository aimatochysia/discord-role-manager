'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { demoGuild } = require('../fixtures/demo-guild');
const { resolveStructureAccess } = require('../src/services/access');
const { renderAccessMap } = require('../src/services/canvasMap');

describe('canvas access map', () => {
  it('renders at least one PNG of the demo server', () => {
    const demo = demoGuild();
    const structure = resolveStructureAccess(
      { name: demo.guild.name, categories: demo.categories, uncategorized: demo.uncategorized },
      demo.rules,
      demo.custom
    );
    const buffers = renderAccessMap(structure);
    assert.ok(buffers.length >= 1);
    assert.ok(buffers[0].length > 5000);
    assert.equal(buffers[0][0], 0x89);
    assert.equal(buffers[0][1], 0x50);
    assert.equal(buffers[0][2], 0x4e);
    assert.equal(buffers[0][3], 0x47);
  });
});
