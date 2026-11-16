/* eslint-disable no-console */
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { placeholderSvg } = require('../src/utils/placeholder');

const USERS = [
  {
    name: 'Mama Sari',
    email: 'admin@tokomama.id',
    password: 'Admin#123',
    role: 'admin',
    phone: '6281234567890',
  },
  {
    name: 'Mama Sari (Seller)',
    email: 'mama@tokomama.id',
    password: 'Seller#123',
    role: 'seller',
    phone: '6281234567891',
  },
  {
    name: 'Budi Santoso',
    email: 'budi@tokomama.id',
    password: 'Seller#123',
    role: 'seller',
    phone: '6281234567892',
  },
  {
    name: 'Siti Aminah',
    email: 'siti@gmail.com',
    password: 'Pembeli#123',
    role: 'pembeli',
    phone: '6281298765432',
  },
  {
    name: 'Rina Wulandari',
    email: 'rina@gmail.com',
    password: 'Pembeli#123',
    role: 'pembeli',
    phone: '6281298765433',
  },
  {
    name: 'Dewi Kartika',
    email: 'dewi@gmail.com',
    password: 'Pembeli#123',
    role: 'pembeli',
    phone: '6281298765434',
    isActive: 0,
  },
];

const CATEGORIES = [
  { name: 'Sembako', slug: 'sembako', description: 'Kebutuhan pokok sehari-hari.' },
  { name: 'Minuman', slug: 'minuman', description: 'Air mineral, kopi, teh, dan sirup.' },
  { name: 'Kebersihan', slug: 'kebersihan', description: 'Sabun, sampo, dan perawatan tubuh.' },
  { name: 'Protein', slug: 'protein', description: 'Telur, daging, ikan, dan sumber protein.' },
  { name: 'Snack', slug: 'snack', description: 'Camilan dan makanan ringan.' },
  { name: 'Bumbu Dapur', slug: 'bumbu-dapur', description: 'Bumbu dan rempah untuk memasak.' },
  { name: 'Rumah Tangga', slug: 'rumah-tangga', description: 'Perlengkapan rumah dan dapur.' },
  {
    name: 'Perlengkapan Bayi',
    slug: 'perlengkapan-bayi',
    description: 'Kebutuhan bayi dan ibu.',
  },
  { name: 'Mainan Anak', slug: 'mainan-anak', description: 'Mainan edukatif dan hiburan anak.' },
];

const PRODUCTS = [
  ['Beras Premium 5kg', 'sembako', 72000, 18, 'Beras pulen kualitas premium kemasan 5 kg.', 1],
  ['Minyak Goreng 2L', 'sembako', 38000, 25, 'Minyak goreng sawit kemasan pouch 2 liter.', 1],
  ['Gula Pasir 1kg', 'sembako', 17000, 40, 'Gula pasir putih bersih kemasan 1 kg.', 0],
  ['Tepung Terigu 1kg', 'sembako', 13500, 32, 'Tepung serbaguna untuk kue dan gorengan.', 0],
  ['Telur Ayam 1kg', 'protein', 28000, 12, 'Telur ayam segar per kilogram.', 1],
  ['Dada Ayam Fillet 500g', 'protein', 32000, 8, 'Fillet dada ayam tanpa tulang, segar.', 0],
  ['Ikan Kembung Segar 1kg', 'protein', 26000, 0, 'Ikan kembung segar hasil tangkapan harian.', 0],
  ['Air Mineral 600ml', 'minuman', 3500, 80, 'Air mineral botol 600 ml.', 0],
  ['Kopi Sachet (10 pcs)', 'minuman', 15000, 50, 'Kopi instan sachet isi 10, praktis.', 1],
  ['Teh Celup 25 Kantung', 'minuman', 8500, 45, 'Teh celup wangi melati isi 25 kantung.', 0],
  ['Susu UHT Cokelat 1L', 'minuman', 19000, 22, 'Susu UHT rasa cokelat kemasan 1 liter.', 0],
  ['Sabun Mandi Batang', 'kebersihan', 4500, 60, 'Sabun mandi wangi, isi 1 batang.', 0],
  ['Pasta Gigi 120g', 'kebersihan', 12000, 35, 'Pasta gigi rasa mint kemasan 120 gram.', 0],
  ['Sampo Anti Ketombe 340ml', 'kebersihan', 27500, 20, 'Sampo anti ketombe untuk kulit kepala sensitif.', 0],
  ['Deterjen Bubuk 1kg', 'kebersihan', 21000, 28, 'Deterjen bubuk wangi, efektif menghilangkan noda.', 0],
  ['Keripik Singkong 150g', 'snack', 9000, 55, 'Keripik singkong renyah rasa pedas manis.', 0],
  ['Biskuit Cokelat 300g', 'snack', 14500, 38, 'Biskuit renyah dengan lapisan krim cokelat.', 1],
  ['Kacang Panggang 200g', 'snack', 11000, 0, 'Kacang tanah panggang gurih kemasan 200 gram.', 0],
  ['Bawang Merah 500g', 'bumbu-dapur', 12500, 30, 'Bawang merah segar pilihan.', 0],
  ['Cabai Rawit Merah 250g', 'bumbu-dapur', 9500, 16, 'Cabai rawit merah segar, pedas mantap.', 0],
  ['Kecap Manis 520ml', 'bumbu-dapur', 16500, 41, 'Kecap manis dari kedelai hitam pilihan.', 0],
  ['Wajan Anti Lengket 24cm', 'rumah-tangga', 89000, 7, 'Wajan anti lengket ukuran 24 cm untuk dapur.', 1],
  ['Tempat Sampah 15L', 'rumah-tangga', 45000, 10, 'Tempat sampah plastik dengan tutup, 15 liter.', 0],
  ['Diapers Bayi M-40', 'perlengkapan-bayi', 68000, 14, 'Popok bayi ukuran M isi 40 lembar, daya serap tinggi.', 1],
  ['Tisu Basah Bayi 80 Lembar', 'perlengkapan-bayi', 18500, 26, 'Tisu basah lembut tanpa alkohol untuk bayi.', 0],
  ['Botol Susu Anti Kolik 250ml', 'perlengkapan-bayi', 54000, 9, 'Botol susu dengan sistem ventilasi anti kolik.', 0],
  ['Puzzle Kayu Edukatif', 'mainan-anak', 42000, 13, 'Puzzle kayu edukatif untuk melatih motorik anak.', 0],
  ['Bola Plastik Warna 20cm', 'mainan-anak', 24000, 21, 'Bola plastik warna cerah, aman untuk anak.', 0],
];

(async () => {
  console.log('Mengosongkan data lama…');
  if (db.isPostgres) {
    await db.query(
      'TRUNCATE TABLE products, categories, sessions, users, settings RESTART IDENTITY CASCADE'
    );
  } else {
    await db.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.query('DELETE FROM products');
    await db.query('DELETE FROM categories');
    await db.query('DELETE FROM sessions');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM settings');
    for (const table of ['users', 'categories', 'products']) {
      await db.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log('Membuat akun dummy…');
  const userIds = {};
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    const result = await db.insert(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.name, user.email, passwordHash, user.role, user.phone || null, user.isActive === 0 ? 0 : 1]
    );
    userIds[user.email] = result.insertId;
  }

  const sellerIds = [
    userIds['mama@tokomama.id'],
    userIds['budi@tokomama.id'],
  ];
  const adminId = userIds['admin@tokomama.id'];

  console.log('Membuat kategori…');
  const categoryIds = {};
  for (const category of CATEGORIES) {
    const result = await db.insert(
      'INSERT INTO categories (name, slug, description, created_by) VALUES (?, ?, ?, ?)',
      [category.name, category.slug, category.description, sellerIds[0]]
    );
    categoryIds[category.slug] = result.insertId;
  }

  console.log('Membuat produk…');
  let index = 0;
  for (const [name, categorySlug, price, stock, description, isFeatured] of PRODUCTS) {
    const sellerId = sellerIds[index % sellerIds.length];
    await db.query(
      `INSERT INTO products (seller_id, category_id, name, price, stock, description, image_url, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sellerId,
        categoryIds[categorySlug],
        name,
        price,
        stock,
        description,
        placeholderSvg(name, categorySlug),
        isFeatured,
      ]
    );
    index += 1;
  }

  console.log('Menyimpan pengaturan toko…');
  await db.setSetting('whatsapp_number', '6281234567890');
  await db.setSetting('store_name', 'Toko Mama');

  console.log(`Selesai: ${USERS.length} user, ${CATEGORIES.length} kategori, ${PRODUCTS.length} produk.`);
  console.log('Akun demo:');
  USERS.forEach((user) => {
    console.log(`  ${user.role.padEnd(8)} ${user.email} / ${user.password}`);
  });
  console.log(`Admin utama id=${adminId}`);

  await db.close();
})().catch(async (error) => {
  console.error('Gagal mengisi data dummy:', error);
  try {
    await db.close();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
