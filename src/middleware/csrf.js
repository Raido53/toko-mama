const crypto = require('crypto');

function csrfToken(req, res, next) {
  if (!req.session) return next();
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  return next();
}

/**
 * Untuk request urlencoded/json, token dibaca dari body.
 * Route multipart memakai verifyCsrf setelah multer mem-parse body.
 */
function verifyCsrf(req, res, next) {
  if (req.method !== 'POST') return next();
  if (req.is('multipart/form-data')) return next();

  const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!token || !req.session || token !== req.session.csrfToken) {
    return res.status(403).render('errors/403', {
      title: 'Sesi kedaluwarsa',
      message: 'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.',
    });
  }
  return next();
}

function verifyCsrfForParsedBody(req, res, next) {
  if (req.method !== 'POST') return next();
  const token = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!token || !req.session || token !== req.session.csrfToken) {
    return res.status(403).render('errors/403', {
      title: 'Sesi kedaluwarsa',
      message: 'Token keamanan tidak valid. Muat ulang halaman lalu coba lagi.',
    });
  }
  return next();
}

module.exports = { csrfToken, verifyCsrf, verifyCsrfForParsedBody };
