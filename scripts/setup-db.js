/* eslint-disable no-console */
require('../src/config');

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../src/config');

const RESET = process.argv.includes('--reset');

(async () => {
  const { host, port, user, password, database } = config.db;

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
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
})().catch((error) => {
  console.error('Gagal menyiapkan database:', error.message);
  process.exit(1);
});
