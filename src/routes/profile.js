const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncHandler } = require('../utils/async');
const { str, normalizeWhatsappNumber } = require('../utils/validate');
const { requireLogin } = require('../middleware/auth');
const { verifyCsrfForParsedBody } = require('../middleware/csrf');
const { upload, storedImageUrl, removeUploadedFile } = require('../uploads');
const { homeFor } = require('../middleware/auth');

const router = express.Router();

router.get('/profil', requireLogin, (req, res) => {
  res.render('account/profile', {
    title: 'Profil Saya',
    form: {
      name: req.user.name,
      phone: req.user.phone || '',
    },
    errors: [],
  });
});

router.post(
  '/profil',
  requireLogin,
  upload.single('avatar'),
  verifyCsrfForParsedBody,
  asyncHandler(async (req, res) => {
    const name = str(req.body.name).slice(0, 80);
    const phone = normalizeWhatsappNumber(req.body.phone).slice(0, 20);
    const errors = [];

    if (name.length < 2) errors.push('Nama minimal 2 karakter.');
    if (phone && !/^62\d{8,13}$/.test(phone)) {
      errors.push('Nomor WhatsApp tidak valid (kode negara 62, 8–15 digit).');
    }

    if (errors.length) {
      if (req.file) removeUploadedFile(storedImageUrl(req.file));
      return res.status(400).render('account/profile', {
        title: 'Profil Saya',
        form: { name, phone: str(req.body.phone) },
        errors,
      });
    }

    let avatarUrl = req.user.avatar_url || null;
    if (req.file) {
      avatarUrl = storedImageUrl(req.file);
      if (req.user.avatar_url) removeUploadedFile(req.user.avatar_url);
    } else if (req.body.remove_avatar === '1') {
      if (req.user.avatar_url) removeUploadedFile(req.user.avatar_url);
      avatarUrl = null;
    }

    await db.query('UPDATE users SET name = ?, phone = ?, avatar_url = ? WHERE id = ?', [
      name,
      phone || null,
      avatarUrl,
      req.user.id,
    ]);

    res.locals.addFlash('success', 'Profil berhasil diperbarui.');
    return res.redirect('/profil');
  })
);

router.post(
  '/profil/password',
  requireLogin,
  asyncHandler(async (req, res) => {
    const currentPassword = str(req.body.current_password);
    const newPassword = str(req.body.new_password);
    const confirmPassword = str(req.body.confirm_password);

    const renderError = (message) =>
      res.status(400).render('account/profile', {
        title: 'Profil Saya',
        form: { name: req.user.name, phone: req.user.phone || '' },
        errors: [message],
      });

    const row = await db.one('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (!row || !(await bcrypt.compare(currentPassword, row.password_hash))) {
      return renderError('Password saat ini salah.');
    }
    if (newPassword.length < 8) return renderError('Password baru minimal 8 karakter.');
    if (newPassword !== confirmPassword) return renderError('Konfirmasi password tidak cocok.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    await db.query('DELETE FROM sessions WHERE session_id <> ?', [req.sessionID]);

    res.locals.addFlash('success', 'Password berhasil diubah. Sesi lain telah dikeluarkan.');
    return res.redirect('/profil');
  })
);

router.get('/akun', requireLogin, (req, res) => {
  if (req.user.role === 'pembeli') return res.redirect('/profil');
  return res.redirect(homeFor(req.user));
});

module.exports = router;
