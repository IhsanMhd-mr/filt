const { Pool } = require('pg');
require('dotenv').config();

// Check if we're connecting to a Render database (external host)
const isRenderDB = process.env.DB_HOST && process.env.DB_HOST.includes('render.com');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'test',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '123',
  // Enable SSL for Render PostgreSQL (always for external hosts, or if explicitly required)
  ssl: isRenderDB ? { rejectUnauthorized: false } : false,
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
