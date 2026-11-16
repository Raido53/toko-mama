function flash(req, res, next) {
  res.locals.flash = (req.session && req.session.flash) || [];
  if (req.session) req.session.flash = [];

  res.locals.addFlash = (type, message) => {
    if (!req.session) return;
    if (!Array.isArray(req.session.flash)) req.session.flash = [];
    req.session.flash.push({ type, message });
  };

  next();
}

module.exports = flash;
