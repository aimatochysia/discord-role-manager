'use strict';

const fs = require('fs');
const path = require('path');
const { demoGuild } = require('../fixtures/demo-guild');
const { resolveStructureAccess } = require('../src/services/access');
const { renderAccessMap } = require('../src/services/canvasMap');

const demo = demoGuild();
const structure = resolveStructureAccess(
  {
    id: demo.guild.id,
    name: demo.guild.name,
    icon: null,
    memberCount: demo.guild.memberCount,
    ownerId: demo.guild.ownerId,
    categories: demo.categories,
    uncategorized: demo.uncategorized
  },
  demo.rules,
  demo.custom
);

const outDir = path.join(__dirname, '..', 'output');
fs.mkdirSync(outDir, { recursive: true });
const buffers = renderAccessMap(structure);
buffers.forEach((buffer, index) => {
  const file = path.join(outDir, `access-map-${index + 1}.png`);
  fs.writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.length} bytes)`);
});
