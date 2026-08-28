'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getWatchedVerifyMessageIds,
  isWatchedVerifyMessage
} = require('../src/services/verification');

describe('verify message watch list', () => {
  it('watches VERIFY_MESSAGE_ID from env with no database setup', () => {
    const env = { verifyMessageId: '123456789012345678' };
    assert.equal(isWatchedVerifyMessage('123456789012345678', env, null), true);
    assert.equal(isWatchedVerifyMessage('999', env, null), false);
  });

  it('still watches a message posted by /setup verify', () => {
    const settings = { verify_message_id: '111' };
    assert.equal(isWatchedVerifyMessage('111', {}, settings), true);
    assert.equal(isWatchedVerifyMessage('111', { verifyMessageId: '222' }, settings), true);
    assert.equal(isWatchedVerifyMessage('222', { verifyMessageId: '222' }, settings), true);
  });

  it('does not grant from random messages', () => {
    const ids = getWatchedVerifyMessageIds({}, null);
    assert.equal(ids.size, 0);
    assert.equal(isWatchedVerifyMessage('123', {}, null), false);
    assert.equal(isWatchedVerifyMessage('', { verifyMessageId: '123' }, null), false);
  });
});
