import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'sak_access_control',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    timezone: process.env.TZ || 'Asia/Kolkata'
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    directory: './migrations',
    extension: 'ts'
  },
  seeds: {
    directory: './seeds',
    extension: 'ts'
  }
});

export default db;
