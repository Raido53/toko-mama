const express = require('express');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/akun', requireLogin, (req, res) => {
  if (req.user.role === 'admin') return res.redirect('/admin/users');
  if (req.user.role === 'seller') return res.redirect('/seller/produk');

  return res.render('account/show', {
    title: 'Akun Saya',
  });
});

module.exports = router;
