'use strict';

function createRepos(knex) {
  return {
    async getSettings(guildId) {
      return knex('guild_settings').where({ guild_id: guildId }).first();
    },

    async upsertSettings(guildId, patch) {
      const existing = await this.getSettings(guildId);
      if (existing) {
        const [row] = await knex('guild_settings')
          .where({ guild_id: guildId })
          .update({ ...patch, updated_at: knex.fn.now() })
          .returning('*');
        return row;
      }
      const [row] = await knex('guild_settings')
        .insert({ guild_id: guildId, ...patch })
        .returning('*');
      return row;
    },

    async getBindings(guildId) {
      const rows = await knex('rank_bindings').where({ guild_id: guildId });
      return Object.fromEntries(rows.map((row) => [row.rank_key, row.role_id]));
    },

    async listBindings(guildId) {
      return knex('rank_bindings').where({ guild_id: guildId });
    },

    async setBinding(guildId, rankKey, roleId) {
      const existing = await knex('rank_bindings').where({ guild_id: guildId, rank_key: rankKey }).first();
      if (existing) {
        const [row] = await knex('rank_bindings')
          .where({ id: existing.id })
          .update({ role_id: roleId, updated_at: knex.fn.now() })
          .returning('*');
        return row;
      }
      const [row] = await knex('rank_bindings')
        .insert({ guild_id: guildId, rank_key: rankKey, role_id: roleId })
        .returning('*');
      return row;
    },

    async deleteBinding(guildId, rankKey) {
      return knex('rank_bindings').where({ guild_id: guildId, rank_key: rankKey }).del();
    },

    async getRules(guildId) {
      return knex('access_rules').where({ guild_id: guildId });
    },

    async upsertRule(guildId, targetType, targetId, { profileKey, inherit }) {
      const existing = await knex('access_rules')
        .where({ guild_id: guildId, target_type: targetType, target_id: targetId })
        .first();
      const patch = {
        profile_key: profileKey,
        inherit: inherit !== false
      };
      if (existing) {
        const [row] = await knex('access_rules')
          .where({ id: existing.id })
          .update({ ...patch, updated_at: knex.fn.now() })
          .returning('*');
        return row;
      }
      const [row] = await knex('access_rules')
        .insert({
          guild_id: guildId,
          target_type: targetType,
          target_id: targetId,
          ...patch
        })
        .returning('*');
      return row;
    },

    async getCustom(guildId) {
      return knex('access_custom').where({ guild_id: guildId });
    },

    async replaceCustom(guildId, targetType, targetId, ranks) {
      await knex('access_custom')
        .where({ guild_id: guildId, target_type: targetType, target_id: targetId })
        .del();
      const rows = Object.entries(ranks || {})
        .filter(([, value]) => value && (value.view || value.send || value.can_view || value.can_send))
        .map(([rankKey, value]) => ({
          guild_id: guildId,
          target_type: targetType,
          target_id: targetId,
          rank_key: rankKey,
          can_view: Boolean(value.view ?? value.can_view),
          can_send: Boolean(value.send ?? value.can_send)
        }));
      if (!rows.length) return [];
      return knex('access_custom').insert(rows).returning('*');
    },

    async listRequests(guildId, status = 'pending') {
      const query = knex('trainee_requests').where({ guild_id: guildId }).orderBy('id', 'desc');
      if (status) query.andWhere({ status });
      return query;
    },

    async getRequest(id) {
      return knex('trainee_requests').where({ id }).first();
    },

    async createRequest(row) {
      const [created] = await knex('trainee_requests').insert(row).returning('*');
      return created;
    },

    async reviewRequest(id, { status, reviewerId, note }) {
      const [row] = await knex('trainee_requests')
        .where({ id })
        .update({
          status,
          reviewer_id: reviewerId,
          review_note: note || null,
          reviewed_at: knex.fn.now(),
          updated_at: knex.fn.now()
        })
        .returning('*');
      return row;
    },

    async addAudit(guildId, actorId, action, details) {
      const [row] = await knex('audit_logs')
        .insert({
          guild_id: guildId,
          actor_id: actorId,
          action,
          details: details || null
        })
        .returning('*');
      return row;
    },

    async listAudit(guildId, limit = 50) {
      return knex('audit_logs').where({ guild_id: guildId }).orderBy('id', 'desc').limit(limit);
    },

    async createSession({ tokenHash, userId, guildId, expiresAt }) {
      const [row] = await knex('dashboard_sessions')
        .insert({
          token_hash: tokenHash,
          user_id: userId,
          guild_id: guildId || null,
          expires_at: expiresAt
        })
        .returning('*');
      return row;
    },

    async getSession(tokenHash) {
      return knex('dashboard_sessions')
        .where({ token_hash: tokenHash })
        .andWhere('expires_at', '>', knex.fn.now())
        .first();
    },

    async deleteSession(tokenHash) {
      return knex('dashboard_sessions').where({ token_hash: tokenHash }).del();
    }
  };
}

module.exports = { createRepos };
