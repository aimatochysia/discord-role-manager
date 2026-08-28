'use strict';

const CHANNEL_TYPES = {
  0: 'text',
  2: 'voice',
  4: 'category',
  5: 'announcement',
  13: 'stage',
  15: 'forum',
  16: 'media',
  text: 'text',
  voice: 'voice',
  category: 'category',
  announcement: 'announcement',
  stage: 'stage',
  forum: 'forum',
  media: 'media'
};

function channelKind(type) {
  return CHANNEL_TYPES[type] || 'text';
}

module.exports = { CHANNEL_TYPES, channelKind };
