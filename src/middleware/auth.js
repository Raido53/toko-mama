const db = require('../db');
const config = require('../config');

const ROLE_LABELS = { admin: 'Admin', seller: 'Seller', pembeli: 'Pembeli' };

async function attachUser(req, res, next) {
  res.locals.currentUser = null;
  res.locals.roles = ROLE_LABELS;
  req.user = null;

  if (!req.session || !req.session.userId) return next();

  try {
    const user = await db.one(
      'SELECT id, name, email, role, phone, avatar_url, is_active, created_at, last_login_at FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );

    if (!user || !user.is_active) {
      req.session.userId = null;
      req.session.csrfToken = null;
      return next();
    }

    req.user = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireLogin(req, res, next) {
  if (req.user) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/login?next=${nextUrl}`);
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      const nextUrl = encodeURIComponent(req.originalUrl || '/');
      return res.redirect(`/login?next=${nextUrl}`);
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('errors/403', { title: 'Akses ditolak' });
    }
    return next();
  };
}

function homeFor(user) {
  if (!user) return '/';
  if (user.role === 'admin') return '/admin/users';
  if (user.role === 'seller') return '/seller/produk';
  return '/akun';
}

function safeRedirect(target, fallback) {
  if (typeof target !== 'string') return fallback;
  if (!target.startsWith('/') || target.startsWith('//')) return fallback;
  if (target.startsWith('/login') || target.startsWith('/logout')) return fallback;
  return target;
}

module.exports = { attachUser, requireLogin, requireRole, homeFor, safeRedirect, ROLE_LABELS, config };
