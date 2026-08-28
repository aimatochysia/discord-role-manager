require('dotenv').config();

const connection = process.env.DATABASE_URL || 'postgres://rolebot:rolebot@localhost:5432/rolebot';

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    pool: { min: 0, max: 10 }
  },
  production: {
    client: 'pg',
    connection,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations'
    },
    pool: { min: 2, max: 20 }
  }
};
