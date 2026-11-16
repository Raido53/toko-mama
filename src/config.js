const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const env = process.env.NODE_ENV || 'development';
const sessionSecret =
  process.env.SESSION_SECRET || 'dev-only-insecure-session-secret-change-me';

if (env === 'production' && sessionSecret.startsWith('dev-only')) {
  throw new Error('SESSION_SECRET wajib diisi dengan nilai acak di production.');
}

const databaseUrl = process.env.DATABASE_URL || '';
const dbClient = (process.env.DB_CLIENT || (databaseUrl ? 'postgres' : 'mysql')).toLowerCase();
const isPostgres = dbClient === 'postgres';

const config = {
  env,
  isProduction: env === 'production',
  host: process.env.HOST || '127.0.0.1',
  port: Number(process.env.PORT || 3000),
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  db: {
    // 'postgres' untuk Supabase, 'mysql' untuk database lokal.
    client: dbClient,
    url: databaseUrl,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || (isPostgres ? 5432 : 3306)),
    user: process.env.DB_USER || (isPostgres ? 'postgres' : 'root'),
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'ServBay.dev',
    database: process.env.DB_NAME || 'toko_mama',
    ssl:
      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: process.env.DB_SSL_VERIFY === 'true' }
        : undefined,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  },
  session: {
    name: 'toko_mama.sid',
    secret: sessionSecret,
    maxAge: 1000 * 60 * 60 * 8,
  },
  uploadsDir: path.join(__dirname, '..', 'public', 'uploads'),
  maxUploadBytes: 2 * 1024 * 1024,
  roles: ['admin', 'seller', 'pembeli'],
};

module.exports = config;
