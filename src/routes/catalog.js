const express = require('express');
const db = require('../db');
const { asyncHandler } = require('../utils/async');

const router = express.Router();

const SORTS = {
  'nama-asc': 'p.name ASC',
  'harga-asc': 'p.price ASC',
  'harga-desc': 'p.price DESC',
  'stok-desc': 'p.stock DESC',
  terbaru: 'p.created_at DESC',
};

async function loadCategories() {
  return db.query('SELECT id, name, slug FROM categories ORDER BY name ASC');
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const category = String(req.query.kategori || '').trim();
    const sort = SORTS[req.query.sort] ? req.query.sort : 'nama-asc';

    const where = [];
    const params = [];
    if (q) {
      where.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }

    const products = await db.query(
      `SELECT p.id, p.name, p.price, p.stock, p.description, p.image_url, p.is_featured,
              c.name AS category_name, c.slug AS category_slug, u.name AS seller_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY ${SORTS[sort]}, p.id ASC
        LIMIT 120`,
      params
    );

    const categories = await loadCategories();
    const total = await db.one('SELECT COUNT(*) AS total FROM products');

    res.render('catalog/index', {
      title: 'Katalog Produk',
      products,
      categories,
      q,
      category,
      sort,
      totalProducts: Number(total ? total.total : 0),
    });
  })
);

router.get(
  '/produk/:id',
  asyncHandler(async (req, res, next) => {
    const product = await db.one(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug, u.name AS seller_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN users u ON u.id = p.seller_id
        WHERE p.id = ? LIMIT 1`,
      [req.params.id]
    );

    if (!product) return next();

    const related = await db.query(
      `SELECT p.id, p.name, p.price, p.stock, p.image_url, p.is_featured, c.name AS category_name
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.category_id = ? AND p.id <> ?
        ORDER BY p.is_featured DESC, p.name ASC LIMIT 4`,
      [product.category_id, product.id]
    );

    return res.render('catalog/show', {
      title: product.name,
      product,
      related,
    });
  })
);

module.exports = router;
