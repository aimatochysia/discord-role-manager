'use strict';

const knexConfig = require('../../knexfile');

function createDb(env = process.env.NODE_ENV || 'development') {
  const knex = require('knex')(knexConfig[env] || knexConfig.development);
  return knex;
}

async function migrateLatest(knex) {
  await knex.migrate.latest();
}

module.exports = { createDb, migrateLatest };
