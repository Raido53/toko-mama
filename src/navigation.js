const db = require('./db');

let cache = { data: null, expiresAt: 0 };

async function getNavCategories(force = false) {
  const now = Date.now();
  if (force || !cache.data || cache.expiresAt < now) {
    const rows = await db.query(
      `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC`
    );
    cache = {
      data: rows.map((row) => ({ ...row, product_count: Number(row.product_count) })),
      expiresAt: now + 60 * 1000,
    };
  }
  return cache.data;
}

function invalidateNavCache() {
  cache = { data: null, expiresAt: 0 };
}

module.exports = { getNavCategories, invalidateNavCache };
