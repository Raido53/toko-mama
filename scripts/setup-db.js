/* eslint-disable no-console */
require('../src/config');

const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const RESET = process.argv.includes('--reset');

async function setupPostgres() {
  const { Client } = require('pg');
  const client = new Client({
    connectionString: config.db.url || undefined,
    host: config.db.url ? undefined : config.db.host,
    port: config.db.url ? undefined : config.db.port,
    user: config.db.url ? undefined : config.db.user,
    password: config.db.url ? undefined : config.db.password,
    database: config.db.url ? undefined : config.db.database,
    ssl: config.db.ssl,
  });

  try {
    await client.connect();
  } catch (error) {
    if (error.code === '3D000') {
      throw new Error(
        'Database belum ada. Buat project/database di Supabase lalu isi DATABASE_URL dari menu Project Settings → Database.'
      );
    }
    throw error;
  }

  try {
    if (RESET) {
      console.log('Menghapus tabel lama…');
      await client.query(
        'DROP TABLE IF EXISTS products, categories, sessions, settings, users CASCADE'
      );
    }

    const schema = fs.readFileSync(path.join(__dirname, 'schema.pg.sql'), 'utf8');
    await client.query(schema);

    console.log('Database PostgreSQL siap (Supabase).');
    if (!RESET) {
      console.log('Tabel dibuat jika belum ada. Jalankan `npm run db:seed` untuk data contoh.');
    }
  } finally {
    await client.end();
  }
}

async function setupMysql() {
  const mysql = require('mysql2/promise');
  const { host, port, user, password, database, ssl } = config.db;

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    ssl,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${database}\``);

    if (RESET) {
      console.log('Menghapus tabel lama…');
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      await connection.query('DROP TABLE IF EXISTS products, categories, settings, sessions, users');
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);

    console.log(`Database "${database}" siap di ${host}:${port}.`);
    if (!RESET) {
      console.log('Tabel dibuat jika belum ada. Jalankan `npm run db:seed` untuk data contoh.');
    }
  } finally {
    await connection.end();
  }
}

(async () => {
  if (config.db.client === 'postgres') {
    await setupPostgres();
  } else {
    await setupMysql();
  }
})().catch((error) => {
  console.error('Gagal menyiapkan database:', error.message);
  process.exit(1);
});
