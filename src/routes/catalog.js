const express = require('express');
const db = require('../db');
const { asyncHandler } = require('../utils/async');
const { getNavCategories } = require('../navigation');

const router = express.Router();

const SORTS = {
  'nama-asc': 'p.name ASC',
  'harga-asc': 'p.price ASC',
  'harga-desc': 'p.price DESC',
  'stok-desc': 'p.stock DESC',
  terbaru: 'p.created_at DESC',
};

const BASE_SELECT = `SELECT p.id, p.name, p.price, p.stock, p.description, p.image_url, p.is_featured,
                            c.name AS category_name, c.slug AS category_slug, u.name AS seller_name
                       FROM products p
                       JOIN categories c ON c.id = p.category_id
                       JOIN users u ON u.id = p.seller_id`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 80);
    const category = String(req.query.kategori || '').trim();
    const sort = SORTS[req.query.sort] ? req.query.sort : 'terbaru';
    const isFiltering = Boolean(q || category);

    const where = [];
    const params = [];
    if (q) {
      where.push(`(p.name ${db.like} ? OR p.description ${db.like} ? OR c.name ${db.like} ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('c.slug = ?');
      params.push(category);
    }

    const [products, featured, categories, totals] = await Promise.all([
      db.query(
        `${BASE_SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ${SORTS[sort]}, p.id DESC LIMIT 120`,
        params
      ),
      db.query(`${BASE_SELECT} WHERE p.is_featured = 1 ORDER BY p.updated_at DESC LIMIT 5`),
      getNavCategories(true),
      db.one(
        `SELECT (SELECT COUNT(*) FROM products) AS products,
                (SELECT COUNT(*) FROM categories) AS categories,
                (SELECT COUNT(*) FROM users WHERE role = 'seller' AND is_active = 1) AS sellers`
      ),
    ]);

    const activeCategory = categories.find((item) => item.slug === category) || null;

    res.render('catalog/index', {
      title: 'Katalog Produk',
      products,
      featured,
      categories,
      q,
      category,
      activeCategory,
      sort,
      isFiltering,
      totals: {
        products: Number(totals.products),
        categories: Number(totals.categories),
        sellers: Number(totals.sellers),
      },
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
      `SELECT p.id, p.name, p.price, p.stock, p.image_url, p.is_featured,
              p.description, c.name AS category_name
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
