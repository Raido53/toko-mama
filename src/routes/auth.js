const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { asyncHandler } = require('../utils/async');
const { str, isEmail } = require('../utils/validate');
const { homeFor, safeRedirect } = require('../middleware/auth');

const router = express.Router();

// Pembatasan percobaan login sederhana (per IP + email) untuk mencegah brute force.
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function attemptKey(req, email) {
  return `${req.ip}:${email}`;
}

function tooManyAttempts(key) {
  const record = attempts.get(key);
  if (!record) return false;
  if (Date.now() - record.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function registerFailure(key) {
  const record = attempts.get(key);
  if (!record || Date.now() - record.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
    return;
  }
  record.count += 1;
}

router.get('/login', (req, res) => {
  if (req.user) return res.redirect(homeFor(req.user));
  return res.render('auth/login', {
    title: 'Masuk',
    email: '',
    next: safeRedirect(String(req.query.next || ''), ''),
  });
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = str(req.body.email).toLowerCase();
    const password = str(req.body.password);
    const nextUrl = safeRedirect(str(req.body.next), '');

    const renderError = (message) =>
      res.status(400).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl,
        error: message,
      });

    if (!isEmail(email) || !password) {
      return renderError('Email dan password wajib diisi dengan benar.');
    }

    const key = attemptKey(req, email);
    if (tooManyAttempts(key)) {
      return res.status(429).render('auth/login', {
        title: 'Masuk',
        email,
        next: nextUrl,
        error: 'Terlalu banyak percobaan masuk. Coba lagi dalam 10 menit.',
      });
    }

    const user = await db.one(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      registerFailure(key);
      return renderError('Email atau password salah.');
    }

    if (!user.is_active) {
      return renderError('Akun ini sedang dinonaktifkan. Hubungi admin toko.');
    }

    attempts.delete(key);

    req.session.regenerate((regenerateError) => {
      if (regenerateError) return res.redirect('/login');

      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.csrfToken = null;

      db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});

      req.session.save(() => {
        res.redirect(nextUrl || homeFor(user));
      });
    });
  })
);

router.post('/logout', (req, res, next) => {
  if (!req.session) return res.redirect('/login');
  return req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('toko_mama.sid');
    return res.redirect('/login');
  });
});

module.exports = router;
