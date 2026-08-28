'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embed, WARN } = require('../utils/embeds');

function requestEmbed(request, requesterTag) {
  const payload = request.payload || {};
  const lines = [
    `**Action:** \`${request.action_type}\``,
    `**Trainee:** ${requesterTag}`,
    payload.targetTag || payload.targetUserId ? `**Target:** ${payload.targetTag || `<@${payload.targetUserId}>`}` : null,
    payload.durationMs ? `**Duration:** ${Math.round(payload.durationMs / 60000)} minutes` : null,
    payload.reason ? `**Reason:** ${payload.reason}` : null,
    '',
    'A moderator must approve this before it happens.'
  ].filter(Boolean);

  return embed({
    title: 'Trainee request',
    description: lines.join('\n'),
    color: WARN,
    footer: `Request #${request.id}`
  });
}

function requestComponents(requestId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rm:trainee:approve:${requestId}`)
        .setLabel('Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rm:trainee:deny:${requestId}`)
        .setLabel('Deny')
        .setStyle(ButtonStyle.Danger)
    )
  ];
}

async function submitRequest(repos, { guildId, requesterId, actionType, payload, channelId }) {
  return repos.createRequest({
    guild_id: guildId,
    requester_id: requesterId,
    action_type: actionType,
    payload,
    status: 'pending',
    channel_id: channelId || null
  });
}

module.exports = { requestEmbed, requestComponents, submitRequest };
