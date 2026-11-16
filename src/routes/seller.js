const express = require('express');
const multer = require('multer');
const db = require('../db');
const { asyncHandler } = require('../utils/async');
const { str, int } = require('../utils/validate');
const { slugify } = require('../utils/format');
const { requireRole } = require('../middleware/auth');
const { invalidateNavCache } = require('../navigation');
const { verifyCsrfForParsedBody } = require('../middleware/csrf');
const { upload, storedImageUrl, removeUploadedFile } = require('../uploads');

const router = express.Router();

router.use(requireRole('seller'));

const PRODUCT_SORTS = {
  'nama-asc': 'p.name ASC',
  'nama-desc': 'p.name DESC',
  'harga-asc': 'p.price ASC',
  'harga-desc': 'p.price DESC',
  'stok-desc': 'p.stock DESC',
  terbaru: 'p.created_at DESC',
};

async function sellerCategories() {
  return db.query(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC`
  );
}

async function productPageData(req, opts = {}) {
  const q = opts.q !== undefined ? opts.q : str(req.query.q);
  const category = opts.category !== undefined ? opts.category : str(req.query.kategori);
  const sort = PRODUCT_SORTS[req.query.sort] ? req.query.sort : PRODUCT_SORTS[opts.sort] ? opts.sort : 'terbaru';
  const editId = opts.editId !== undefined ? opts.editId : Number.parseInt(req.query.edit, 10) || 0;

  const where = ['p.seller_id = ?'];
  const params = [req.user.id];
  if (q) {
    where.push(`(p.name ${db.like} ? OR p.description ${db.like} ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }

  const products = await db.query(
    `SELECT p.id, p.name, p.price, p.stock, p.description, p.image_url, p.is_featured,
            p.category_id, c.name AS category_name, c.slug AS category_slug, p.updated_at
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${PRODUCT_SORTS[sort]}, p.id DESC`,
    params
  );

  const statsRow = await db.one(
    `SELECT COUNT(*) AS total, COALESCE(SUM(stock), 0) AS stock,
            COALESCE(SUM(CASE WHEN is_featured = 1 THEN 1 ELSE 0 END), 0) AS featured,
            COALESCE(SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) AS out_of_stock
       FROM products WHERE seller_id = ?`,
    [req.user.id]
  );

  const categories = await sellerCategories();
  const editProduct = editId
    ? await db.one(
        'SELECT id, name, category_id, price, stock, description, image_url, is_featured FROM products WHERE id = ? AND seller_id = ? LIMIT 1',
        [editId, req.user.id]
      )
    : null;

  const stats = {
    total: Number(statsRow.total),
    stock: Number(statsRow.stock),
    featured: Number(statsRow.featured),
    outOfStock: Number(statsRow.out_of_stock),
    categories: categories.length,
  };

  return { products, categories, q, category, sort, editProduct, stats };
}

function renderProducts(res, data, { form, errors = [], status = 200 } = {}) {
  const defaultForm = data.editProduct
    ? {
        id: String(data.editProduct.id),
        name: data.editProduct.name,
        category_id: String(data.editProduct.category_id),
        price: String(data.editProduct.price),
        stock: String(data.editProduct.stock),
        description: data.editProduct.description || '',
        image_url: data.editProduct.image_url || '',
        is_featured: Boolean(data.editProduct.is_featured),
      }
    : {
        id: '',
        name: '',
        category_id: '',
        price: '',
        stock: '',
        description: '',
        image_url: '',
        is_featured: false,
      };

  return res.status(status).render('seller/products', {
    title: 'Kelola Produk',
    ...data,
    form: form || defaultForm,
    errors,
  });
}

router.get(
  '/produk',
  asyncHandler(async (req, res) => {
    const data = await productPageData(req);
    if (req.query.edit && !data.editProduct) {
      res.locals.addFlash('error', 'Produk yang ingin diedit tidak ditemukan.');
    }
    renderProducts(res, data);
  })
);

async function parseProductForm(req) {
  const errors = [];
  const name = str(req.body.name).slice(0, 80);
  const categoryId = int(req.body.category_id);
  const price = int(req.body.price, { max: 1000000000 });
  const stock = int(req.body.stock, { max: 1000000 });
  const description = str(req.body.description).slice(0, 300);
  const imageUrlInput = str(req.body.image_url);
  const isFeatured = req.body.is_featured === 'on' || req.body.is_featured === '1';

  if (name.length < 2) errors.push('Nama produk minimal 2 karakter.');
  if (!categoryId) errors.push('Pilih kategori produk.');

  if (categoryId) {
    const category = await db.one('SELECT id FROM categories WHERE id = ? LIMIT 1', [categoryId]);
    if (!category) errors.push('Kategori tidak ditemukan.');
  }

  if (price === null) errors.push('Harga harus angka bulat 0 atau lebih.');
  if (stock === null) errors.push('Stok harus angka bulat 0 atau lebih.');

  let imageUrl = '';
  if (req.file) {
    imageUrl = storedImageUrl(req.file);
  } else if (imageUrlInput) {
    if (!/^(https?:\/\/|\/)/i.test(imageUrlInput)) {
      errors.push('URL gambar harus diawali http://, https://, atau /.');
    } else if (imageUrlInput.length > 2000) {
      errors.push('URL gambar terlalu panjang.');
    } else {
      imageUrl = imageUrlInput;
    }
  }

  return {
    errors,
    values: { name, categoryId, price, stock, description, imageUrl, isFeatured, imageUrlInput },
  };
}

function formFromValues(form, values) {
  return {
    id: form.id,
    name: values.name,
    category_id: values.categoryId ? String(values.categoryId) : '',
    price: values.price === null ? '' : String(values.price),
    stock: values.stock === null ? '' : String(values.stock),
    description: values.description,
    image_url: values.imageUrlInput,
    is_featured: values.isFeatured,
  };
}

async function handleSave(req, res, { product }) {
  const { errors, values } = await parseProductForm(req);

  if (errors.length) {
    if (req.file) removeUploadedFile(storedImageUrl(req.file));
    const data = await productPageData(req, {
      q: '',
      category: '',
      editId: product ? product.id : 0,
    });
    return renderProducts(res, data, {
      form: formFromValues({ id: product ? String(product.id) : '' }, values),
      errors,
      status: 400,
    });
  }

  const imageUrl =
    values.imageUrl || (product && product.image_url) || '';

  if (product) {
    if (req.file && product.image_url && product.image_url !== imageUrl) {
      removeUploadedFile(product.image_url);
    }
    await db.query(
      `UPDATE products
          SET name = ?, category_id = ?, price = ?, stock = ?, description = ?, image_url = ?, is_featured = ?
        WHERE id = ? AND seller_id = ?`,
      [
        values.name,
        values.categoryId,
        values.price,
        values.stock,
        values.description,
        imageUrl || null,
        values.isFeatured ? 1 : 0,
        product.id,
        req.user.id,
      ]
    );
    invalidateNavCache();
    res.locals.addFlash('success', `Produk "${values.name}" diperbarui.`);
  } else {
    await db.query(
      `INSERT INTO products (seller_id, category_id, name, price, stock, description, image_url, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        values.categoryId,
        values.name,
        values.price,
        values.stock,
        values.description,
        imageUrl || null,
        values.isFeatured ? 1 : 0,
      ]
    );
    invalidateNavCache();
    res.locals.addFlash('success', `Produk "${values.name}" ditambahkan.`);
  }

  return res.redirect('/seller/produk');
}

router.post(
  '/produk/create',
  upload.single('image'),
  verifyCsrfForParsedBody,
  asyncHandler((req, res) => handleSave(req, res, { product: null }))
);

router.post(
  '/produk/:id/update',
  upload.single('image'),
  verifyCsrfForParsedBody,
  asyncHandler(async (req, res) => {
    const product = await db.one(
      'SELECT id, image_url FROM products WHERE id = ? AND seller_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!product) {
      if (req.file) removeUploadedFile(storedImageUrl(req.file));
      res.locals.addFlash('error', 'Produk tidak ditemukan atau bukan milik Anda.');
      return res.redirect('/seller/produk');
    }
    return handleSave(req, res, { product });
  })
);

router.post(
  '/produk/:id/delete',
  asyncHandler(async (req, res) => {
    const product = await db.one(
      'SELECT id, name, image_url FROM products WHERE id = ? AND seller_id = ? LIMIT 1',
      [req.params.id, req.user.id]
    );
    if (!product) {
      res.locals.addFlash('error', 'Produk tidak ditemukan atau bukan milik Anda.');
      return res.redirect('/seller/produk');
    }

    await db.query('DELETE FROM products WHERE id = ? AND seller_id = ?', [
      product.id,
      req.user.id,
    ]);
    removeUploadedFile(product.image_url);
    invalidateNavCache();
    res.locals.addFlash('success', `Produk "${product.name}" dihapus.`);
    return res.redirect('/seller/produk');
  })
);

/* ---------------------------- Kategori ---------------------------- */

async function uniqueSlug(name, excludeId = 0) {
  const base = slugify(name) || `kategori-${Date.now()}`;
  let candidate = base;
  let counter = 2;
  // Cari slug yang belum dipakai.
  for (;;) {
    const existing = await db.one('SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1', [
      candidate,
      excludeId,
    ]);
    if (!existing) return candidate;
    candidate = `${base}-${counter}`;
    counter += 1;
  }
}

async function categoryPageData(req, opts = {}) {
  const editId = opts.editId !== undefined ? opts.editId : Number.parseInt(req.query.edit, 10) || 0;
  const categories = await sellerCategories();
  const editCategory = editId
    ? await db.one('SELECT id, name, slug, description FROM categories WHERE id = ? LIMIT 1', [editId])
    : null;
  const statsRow = await db.one('SELECT COUNT(*) AS total FROM categories');

  return {
    categories,
    editCategory,
    stats: { total: Number(statsRow.total) },
  };
}

function renderCategories(res, data, { form, errors = [], status = 200 } = {}) {
  return res.status(status).render('seller/categories', {
    title: 'Kelola Kategori',
    ...data,
    form: form ||
      (data.editCategory
        ? {
            id: String(data.editCategory.id),
            name: data.editCategory.name,
            description: data.editCategory.description || '',
          }
        : { id: '', name: '', description: '' }),
    errors,
  });
}

router.get(
  '/kategori',
  asyncHandler(async (req, res) => {
    const data = await categoryPageData(req);
    if (req.query.edit && !data.editCategory) {
      res.locals.addFlash('error', 'Kategori tidak ditemukan.');
    }
    renderCategories(res, data);
  })
);

router.post(
  '/kategori/create',
  asyncHandler(async (req, res) => {
    const name = str(req.body.name).slice(0, 60);
    const description = str(req.body.description).slice(0, 200);
    const errors = [];

    if (name.length < 2) errors.push('Nama kategori minimal 2 karakter.');

    const existing = await db.one('SELECT id FROM categories WHERE name = ? LIMIT 1', [name]);
    if (existing) errors.push('Nama kategori sudah dipakai.');

    if (errors.length) {
      const data = await categoryPageData(req, { editId: 0 });
      return renderCategories(res, data, {
        form: { id: '', name, description },
        errors,
        status: 400,
      });
    }

    const slug = await uniqueSlug(name);
    await db.query(
      'INSERT INTO categories (name, slug, description, created_by) VALUES (?, ?, ?, ?)',
      [name, slug, description || null, req.user.id]
    );

    invalidateNavCache();
    res.locals.addFlash('success', `Kategori "${name}" ditambahkan.`);
    return res.redirect('/seller/kategori');
  })
);

router.post(
  '/kategori/:id/update',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const category = await db.one('SELECT id, name, slug FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!category) {
      res.locals.addFlash('error', 'Kategori tidak ditemukan.');
      return res.redirect('/seller/kategori');
    }

    const name = str(req.body.name).slice(0, 60);
    const description = str(req.body.description).slice(0, 200);
    const errors = [];

    if (name.length < 2) errors.push('Nama kategori minimal 2 karakter.');

    const duplicate = await db.one('SELECT id FROM categories WHERE name = ? AND id <> ? LIMIT 1', [
      name,
      id,
    ]);
    if (duplicate) errors.push('Nama kategori sudah dipakai.');

    if (errors.length) {
      const data = await categoryPageData(req, { editId: id });
      return renderCategories(res, data, {
        form: { id: String(id), name, description },
        errors,
        status: 400,
      });
    }

    const slug = category.name === name ? category.slug : await uniqueSlug(name, id);
    await db.query('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?', [
      name,
      slug,
      description || null,
      id,
    ]);

    invalidateNavCache();
    res.locals.addFlash('success', `Kategori "${name}" diperbarui.`);
    return res.redirect('/seller/kategori');
  })
);

router.post(
  '/kategori/:id/delete',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const category = await db.one('SELECT id, name FROM categories WHERE id = ? LIMIT 1', [id]);
    if (!category) {
      res.locals.addFlash('error', 'Kategori tidak ditemukan.');
      return res.redirect('/seller/kategori');
    }

    const used = await db.one('SELECT COUNT(*) AS total FROM products WHERE category_id = ?', [id]);
    if (Number(used.total) > 0) {
      res.locals.addFlash(
        'error',
        `Kategori "${category.name}" masih dipakai ${used.total} produk. Pindahkan produknya dulu.`
      );
      return res.redirect('/seller/kategori');
    }

    await db.query('DELETE FROM categories WHERE id = ?', [id]);
    invalidateNavCache();
    res.locals.addFlash('success', `Kategori "${category.name}" dihapus.`);
    return res.redirect('/seller/kategori');
  })
);

/* ---------------------- Penanganan error upload ---------------------- */

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error.code === 'INVALID_FILE_TYPE') {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Ukuran gambar maksimal 2 MB.'
        : error.message || 'Gagal mengunggah gambar.';
    res.locals.addFlash('error', message);
    return res.redirect('/seller/produk');
  }
  return next(error);
});

module.exports = router;
