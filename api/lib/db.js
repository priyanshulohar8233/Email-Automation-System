const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL_NEW || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Database URL not found. Please set DATABASE_URL_NEW or DATABASE_URL in Vercel environment variables.");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
