const session = require('express-session');
const db = require('./db');

/**
 * Session store MySQL sederhana memakai pool aplikasi.
 * Menghindari dependensi tambahan dan tabel dibuat oleh scripts/schema.sql.
 */
class MySQLSessionStore extends session.Store {
  constructor({ expirationMs = 1000 * 60 * 60 * 8 } = {}) {
    super();
    this.expirationMs = expirationMs;
    this.cleanupTimer = setInterval(() => {
      db.query('DELETE FROM sessions WHERE expires < ?', [Date.now()]).catch(() => {});
    }, 15 * 60 * 1000);
    if (typeof this.cleanupTimer.unref === 'function') this.cleanupTimer.unref();
  }

  expiryFor(sess) {
    const cookieExpiry = sess && sess.cookie && sess.cookie.expires;
    const expiresAt = cookieExpiry ? new Date(cookieExpiry).getTime() : Date.now() + this.expirationMs;
    return Number.isFinite(expiresAt) ? expiresAt : Date.now() + this.expirationMs;
  }

  get(sid, callback) {
    db.one('SELECT data, expires FROM sessions WHERE session_id = ? LIMIT 1', [sid])
      .then((row) => {
        if (!row) return callback(null, null);
        if (Number(row.expires) < Date.now()) {
          return db
            .query('DELETE FROM sessions WHERE session_id = ?', [sid])
            .then(() => callback(null, null))
            .catch(() => callback(null, null));
        }
        try {
          return callback(null, JSON.parse(row.data));
        } catch (error) {
          return callback(null, null);
        }
      })
      .catch((error) => callback(error));
  }

  set(sid, sess, callback = () => {}) {
    const expires = this.expiryFor(sess);
    db.query(
      `INSERT INTO sessions (session_id, data, expires) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), expires = VALUES(expires)`,
      [sid, JSON.stringify(sess), expires]
    )
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sess, callback = () => {}) {
    db.query('UPDATE sessions SET expires = ? WHERE session_id = ?', [this.expiryFor(sess), sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    db.query('DELETE FROM sessions WHERE session_id = ?', [sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  clear(callback = () => {}) {
    db.query('DELETE FROM sessions')
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  length(callback) {
    db.one('SELECT COUNT(*) AS total FROM sessions')
      .then((row) => callback(null, Number(row.total)))
      .catch((error) => callback(error));
  }
}

module.exports = MySQLSessionStore;
