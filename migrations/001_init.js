'use strict';

exports.up = async function up(knex) {
  await knex.schema.createTable('guild_settings', (table) => {
    table.string('guild_id', 20).primary();
    table.string('verify_channel_id', 20).nullable();
    table.string('verify_message_id', 20).nullable();
    table.string('booster_category_id', 20).nullable();
    table.string('log_channel_id', 20).nullable();
    table.boolean('lockdown_unverified').notNullable().defaultTo(true);
    table.boolean('auto_booster').notNullable().defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('rank_bindings', (table) => {
    table.increments('id').primary();
    table.string('guild_id', 20).notNullable();
    table.string('rank_key', 64).notNullable();
    table.string('role_id', 20).notNullable();
    table.timestamps(true, true);
    table.unique(['guild_id', 'rank_key']);
    table.index(['guild_id']);
  });

  await knex.schema.createTable('access_rules', (table) => {
    table.increments('id').primary();
    table.string('guild_id', 20).notNullable();
    table.string('target_type', 16).notNullable();
    table.string('target_id', 20).notNullable();
    table.string('profile_key', 64).notNullable().defaultTo('hidden');
    table.boolean('inherit').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['guild_id', 'target_type', 'target_id']);
    table.index(['guild_id']);
  });

  await knex.schema.createTable('access_custom', (table) => {
    table.increments('id').primary();
    table.string('guild_id', 20).notNullable();
    table.string('target_type', 16).notNullable();
    table.string('target_id', 20).notNullable();
    table.string('rank_key', 64).notNullable();
    table.boolean('can_view').notNullable().defaultTo(false);
    table.boolean('can_send').notNullable().defaultTo(false);
    table.timestamps(true, true);
    table.unique(['guild_id', 'target_type', 'target_id', 'rank_key']);
  });

  await knex.schema.createTable('trainee_requests', (table) => {
    table.increments('id').primary();
    table.string('guild_id', 20).notNullable();
    table.string('requester_id', 20).notNullable();
    table.string('action_type', 64).notNullable();
    table.jsonb('payload').notNullable();
    table.string('status', 16).notNullable().defaultTo('pending');
    table.string('reviewer_id', 20).nullable();
    table.text('review_note').nullable();
    table.string('message_id', 20).nullable();
    table.string('channel_id', 20).nullable();
    table.timestamp('reviewed_at').nullable();
    table.timestamps(true, true);
    table.index(['guild_id', 'status']);
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.string('guild_id', 20).notNullable();
    table.string('actor_id', 20).nullable();
    table.string('action', 64).notNullable();
    table.jsonb('details').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['guild_id', 'created_at']);
  });

  await knex.schema.createTable('dashboard_sessions', (table) => {
    table.string('token_hash', 64).primary();
    table.string('user_id', 20).notNullable();
    table.string('guild_id', 20).nullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['user_id']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('dashboard_sessions');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('trainee_requests');
  await knex.schema.dropTableIfExists('access_custom');
  await knex.schema.dropTableIfExists('access_rules');
  await knex.schema.dropTableIfExists('rank_bindings');
  await knex.schema.dropTableIfExists('guild_settings');
};
