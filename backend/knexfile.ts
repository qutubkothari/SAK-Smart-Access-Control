import type { Knex } from 'knex';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'sak_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'sak_access_control',
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      extension: 'ts',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds'),
      extension: 'ts'
    }
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'sak_user',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'sak_access_control',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      min: 2,
      max: 20
    },
    migrations: {
      directory: path.join(__dirname, 'src/database/migrations'),
      extension: 'ts',
      tableName: 'knex_migrations'
    },
    seeds: {
      directory: path.join(__dirname, 'src/database/seeds'),
      extension: 'ts'
    }
  }
};

export default config;
