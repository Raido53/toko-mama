const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncHandler } = require('../utils/async');
const { str, isEmail, isRole } = require('../utils/validate');
const { requireRole } = require('../middleware/auth');
const { invalidateWhatsappCache } = require('../settings');
const { normalizeWhatsappNumber, isValidWhatsappNumber } = require('../utils/validate');

const router = express.Router();

router.use(requireRole('admin'));

const EMPTY_FORM = { id: '', name: '', email: '', role: 'pembeli', phone: '' };

async function countActiveAdmins() {
  const row = await db.one(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1"
  );
  return Number(row.total);
}

async function pageData(req, opts = {}) {
  const q = opts.q !== undefined ? opts.q : str(req.query.q);
  const roleFilter = opts.roleFilter !== undefined ? opts.roleFilter : str(req.query.role);
  const editId =
    opts.editId !== undefined ? opts.editId : Number.parseInt(req.query.edit, 10) || 0;

  const where = [];
  const params = [];
  if (q) {
    where.push('(name LIKE ? OR email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (isRole(roleFilter)) {
    where.push('role = ?');
    params.push(roleFilter);
  }

  const users = await db.query(
    `SELECT id, name, email, role, phone, is_active, last_login_at, created_at
       FROM users
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY FIELD(role, 'admin', 'seller', 'pembeli'), name ASC`,
    params
  );

  const roleRows = await db.query(
    'SELECT role, COUNT(*) AS total, SUM(is_active = 1) AS active FROM users GROUP BY role'
  );
  const totals = await db.one('SELECT COUNT(*) AS total, SUM(is_active = 1) AS active FROM users');

  const stats = {
    total: Number(totals.total),
    active: Number(totals.active || 0),
    inactive: Number(totals.total) - Number(totals.active || 0),
    admin: 0,
    seller: 0,
    pembeli: 0,
  };
  roleRows.forEach((row) => {
    stats[row.role] = Number(row.total);
  });

  const editUser = editId
    ? await db.one('SELECT id, name, email, role, phone, is_active FROM users WHERE id = ? LIMIT 1', [
        editId,
      ])
    : null;

  const whatsappNumber = (await db.getSetting('whatsapp_number')) || '';

  return { users, q, roleFilter, stats, editUser, whatsappNumber };
}

function renderPage(res, data, { form, errors = [], status = 200 } = {}) {
  return res.status(status).render('admin/users', {
    title: 'Kelola User',
    ...data,
    form: form || (data.editUser
      ? {
          id: String(data.editUser.id),
          name: data.editUser.name,
          email: data.editUser.email,
          role: data.editUser.role,
          phone: data.editUser.phone || '',
        }
      : { ...EMPTY_FORM }),
    errors,
  });
}

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const data = await pageData(req);
    if (req.query.edit && !data.editUser) {
      res.locals.addFlash('error', 'User yang ingin diedit tidak ditemukan.');
    }
    renderPage(res, data);
  })
);

router.post(
  '/users/create',
  asyncHandler(async (req, res) => {
    const form = {
      id: '',
      name: str(req.body.name).slice(0, 80),
      email: str(req.body.email).toLowerCase().slice(0, 160),
      role: str(req.body.role),
      phone: normalizeWhatsappNumber(req.body.phone).slice(0, 20),
    };
    const password = str(req.body.password);
    const errors = [];

    if (form.name.length < 2) errors.push('Nama minimal 2 karakter.');
    if (!isEmail(form.email)) errors.push('Format email tidak valid.');
    if (!isRole(form.role)) errors.push('Pilih role yang valid.');
    if (password.length < 8) errors.push('Password minimal 8 karakter.');

    if (errors.length) {
      const data = await pageData(req, { q: '', roleFilter: '', editId: 0 });
      return renderPage(res, data, { form, errors, status: 400 });
    }

    const existing = await db.one('SELECT id FROM users WHERE email = ? LIMIT 1', [form.email]);
    if (existing) {
      const data = await pageData(req, { q: '', roleFilter: '', editId: 0 });
      return renderPage(res, data, {
        form,
        errors: ['Email sudah dipakai akun lain.'],
        status: 400,
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [form.name, form.email, passwordHash, form.role, form.phone || null]
    );

    res.locals.addFlash('success', `Akun ${form.name} (${form.role}) berhasil dibuat.`);
    return res.redirect('/admin/users');
  })
);

router.post(
  '/users/:id/update',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.one('SELECT id, name, email, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);
    if (!target) {
      res.locals.addFlash('error', 'User tidak ditemukan.');
      return res.redirect('/admin/users');
    }

    const form = {
      id: String(id),
      name: str(req.body.name).slice(0, 80),
      email: str(req.body.email).toLowerCase().slice(0, 160),
      role: str(req.body.role),
      phone: normalizeWhatsappNumber(req.body.phone).slice(0, 20),
    };
    const password = str(req.body.password);
    const errors = [];

    if (form.name.length < 2) errors.push('Nama minimal 2 karakter.');
    if (!isEmail(form.email)) errors.push('Format email tidak valid.');
    if (!isRole(form.role)) errors.push('Pilih role yang valid.');
    if (password && password.length < 8) errors.push('Password baru minimal 8 karakter.');

    if (req.user.id === id && form.role !== target.role) {
      errors.push('Anda tidak bisa mengubah role akun sendiri.');
    }

    if (target.role === 'admin' && form.role !== 'admin') {
      const admins = await countActiveAdmins();
      if (admins <= 1) errors.push('Minimal harus ada satu admin aktif.');
    }

    if (errors.length) {
      const data = await pageData(req, { q: '', roleFilter: '', editId: id });
      return renderPage(res, data, { form, errors, status: 400 });
    }

    const duplicate = await db.one('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [
      form.email,
      id,
    ]);
    if (duplicate) {
      const data = await pageData(req, { q: '', roleFilter: '', editId: id });
      return renderPage(res, data, {
        form,
        errors: ['Email sudah dipakai akun lain.'],
        status: 400,
      });
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.query(
        `UPDATE users SET name = ?, email = ?, role = ?, phone = ?, password_hash = ? WHERE id = ?`,
        [form.name, form.email, form.role, form.phone || null, passwordHash, id]
      );
    } else {
      await db.query('UPDATE users SET name = ?, email = ?, role = ?, phone = ? WHERE id = ?', [
        form.name,
        form.email,
        form.role,
        form.phone || null,
        id,
      ]);
    }

    res.locals.addFlash('success', `Data ${form.name} berhasil diperbarui.`);
    return res.redirect('/admin/users');
  })
);

router.post(
  '/users/:id/toggle',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.one('SELECT id, name, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);

    if (!target) {
      res.locals.addFlash('error', 'User tidak ditemukan.');
      return res.redirect('/admin/users');
    }
    if (req.user.id === id) {
      res.locals.addFlash('error', 'Anda tidak bisa menonaktifkan akun sendiri.');
      return res.redirect('/admin/users');
    }
    if (target.role === 'admin' && target.is_active) {
      const admins = await countActiveAdmins();
      if (admins <= 1) {
        res.locals.addFlash('error', 'Minimal harus ada satu admin aktif.');
        return res.redirect('/admin/users');
      }
    }

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [target.is_active ? 0 : 1, id]);
    res.locals.addFlash(
      'success',
      `Akun ${target.name} ${target.is_active ? 'dinonaktifkan' : 'diaktifkan'}.`
    );
    return res.redirect('/admin/users');
  })
);

router.post(
  '/users/:id/delete',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const target = await db.one('SELECT id, name, role, is_active FROM users WHERE id = ? LIMIT 1', [id]);

    if (!target) {
      res.locals.addFlash('error', 'User tidak ditemukan.');
      return res.redirect('/admin/users');
    }
    if (req.user.id === id) {
      res.locals.addFlash('error', 'Anda tidak bisa menghapus akun sendiri.');
      return res.redirect('/admin/users');
    }
    if (target.role === 'admin') {
      const admins = await countActiveAdmins();
      if (target.is_active && admins <= 1) {
        res.locals.addFlash('error', 'Minimal harus ada satu admin aktif.');
        return res.redirect('/admin/users');
      }
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.locals.addFlash('success', `Akun ${target.name} dihapus.`);
    return res.redirect('/admin/users');
  })
);

router.post(
  '/settings/whatsapp',
  asyncHandler(async (req, res) => {
    const normalized = normalizeWhatsappNumber(req.body.whatsapp_number);

    if (!isValidWhatsappNumber(normalized)) {
      res.locals.addFlash(
        'error',
        'Nomor WhatsApp tidak valid. Gunakan kode negara 62 dan 8–15 digit angka.'
      );
      return res.redirect('/admin/users');
    }

    await db.setSetting('whatsapp_number', normalized);
    invalidateWhatsappCache();
    res.locals.addFlash('success', 'Nomor WhatsApp admin berhasil diperbarui.');
    return res.redirect('/admin/users');
  })
);

module.exports = router;
