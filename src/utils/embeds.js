'use strict';

const { EmbedBuilder } = require('discord.js');

const BRAND = 0x5865f2;
const OK = 0x23a559;
const WARN = 0xf0b232;
const ERR = 0xf23f42;

function embed({ title, description, color = BRAND, fields = [], footer }) {
  const builder = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) builder.setTitle(title);
  if (description) builder.setDescription(description);
  if (fields.length) builder.addFields(fields);
  if (footer) builder.setFooter({ text: footer });
  return builder;
}

function errorEmbed(description) {
  return embed({ title: 'Something went wrong', description, color: ERR });
}

function successEmbed(title, description) {
  return embed({ title, description, color: OK });
}

module.exports = { BRAND, OK, WARN, ERR, embed, errorEmbed, successEmbed };
