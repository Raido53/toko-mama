const config = require('./config');

const isPostgres = config.db.client === 'postgres';

let pool;

if (isPostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: config.db.url || undefined,
    host: config.db.url ? undefined : config.db.host,
    port: config.db.url ? undefined : config.db.port,
    user: config.db.url ? undefined : config.db.user,
    password: config.db.url ? undefined : config.db.password,
    database: config.db.url ? undefined : config.db.database,
    ssl: config.db.ssl,
    max: config.db.connectionLimit,
    idleTimeoutMillis: 30 * 1000,
  });
} else {
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    ssl: config.db.ssl,
    waitForConnections: true,
    connectionLimit: config.db.connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    dateStrings: true,
    supportBigNumbers: true,
  });
}

/** Ubah placeholder `?` menjadi `$1, $2, …` untuk PostgreSQL. */
function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${(index += 1)}`);
}

/** Operator pencarian teks: LIKE (MySQL) atau ILIKE (PostgreSQL). */
const like = isPostgres ? 'ILIKE' : 'LIKE';

async function query(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPgPlaceholders(sql), params);
    return result.rows;
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * INSERT yang mengembalikan id baris baru.
 * MySQL: insertId dari hasil query. PostgreSQL: memakai RETURNING id.
 */
async function insert(sql, params = []) {
  if (isPostgres) {
    const rows = await query(`${sql} RETURNING id`, params);
    return { insertId: rows[0] ? rows[0].id : null };
  }
  const [result] = await pool.query(sql, params);
  return { insertId: result.insertId };
}

async function getSetting(key) {
  const row = await one('SELECT setting_value FROM settings WHERE setting_key = ?', [key]);
  return row ? row.setting_value : null;
}

async function setSetting(key, value) {
  const sql = isPostgres
    ? `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = now()`
    : `INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`;
  await query(sql, [key, value]);
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  one,
  insert,
  getSetting,
  setSetting,
  close,
  isPostgres,
  like,
};
