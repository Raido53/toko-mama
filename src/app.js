const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const config = require('./config');
const db = require('./db');
const MySQLSessionStore = require('./session-store');
const { getWhatsappNumber } = require('./settings');
const { rupiah, dateId } = require('./utils/format');
const { attachUser } = require('./middleware/auth');
const { csrfToken, verifyCsrf } = require('./middleware/csrf');
const flash = require('./middleware/flash');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: config.isProduction ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(
  '/assets',
  express.static(path.join(__dirname, '..', 'public', 'assets'), {
    maxAge: config.isProduction ? '7d' : 0,
  })
);
app.use(
  '/uploads',
  express.static(config.uploadsDir, { maxAge: '7d', index: false, dotfiles: 'deny' })
);

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '200kb' }));

const sessionStore = new MySQLSessionStore({ expirationMs: config.session.maxAge });

app.use(
  session({
    name: config.session.name,
    secret: config.session.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProduction,
      maxAge: config.session.maxAge,
    },
  })
);

app.use(flash);

// Locals dasar dipasang sebelum validasi CSRF / auth agar halaman error tetap lengkap.
app.use(async (req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.appUrl = config.appUrl;
  res.locals.rupiah = rupiah;
  res.locals.dateId = dateId;
  res.locals.whatsapp = { number: '', link: null, linkFor: () => null };

  try {
    const number = (await getWhatsappNumber()) || '';
    res.locals.whatsapp = {
      number,
      link: number ? `https://wa.me/${number}` : null,
      linkFor: (text) =>
        number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null,
    };
  } catch (error) {
    // Biarkan fallback tanpa nomor WhatsApp bila pengaturan gagal dibaca.
  }

  next();
});

app.use(csrfToken);
app.use(attachUser);
app.use(verifyCsrf);

app.use('/', require('./routes/catalog'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use('/seller', require('./routes/seller'));

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Halaman tidak ditemukan' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(error);
  const status = error.status && error.status < 600 ? error.status : 500;
  return res.status(status).render('errors/500', {
    title: 'Terjadi kesalahan',
    detail: config.isProduction ? null : error.message,
  });
});

async function start() {
  await db.pool.query('SELECT 1');
  const server = app.listen(config.port, config.host, () => {
    const address = server.address();
    const bound =
      address && typeof address === 'object' ? `${address.address}:${address.port}` : String(address);
    console.log(`Toko Mama berjalan di ${config.appUrl} (${config.env}) — listen ${bound}`);
  });

  server.on('error', (error) => {
    console.error('Gagal membuka port:', error.message);
    process.exit(1);
  });

  const shutdown = async () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error('Gagal menjalankan aplikasi:', error.message);
  process.exit(1);
});

module.exports = app;
