const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('./config');

const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

fs.mkdirSync(config.uploadsDir, { recursive: true });

function fileFilter(req, file, callback) {
  if (!ALLOWED[file.mimetype]) {
    const error = new Error('Format gambar harus JPG, PNG, atau WebP.');
    error.code = 'INVALID_FILE_TYPE';
    return callback(error);
  }
  return callback(null, true);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => callback(null, config.uploadsDir),
    filename: (req, file, callback) => {
      const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`;
      callback(null, name);
    },
  }),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter,
});

/** Hapus file upload lama, hanya untuk path yang dikelola aplikasi. */
function removeUploadedFile(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
  const filename = path.basename(imageUrl);
  const target = path.join(config.uploadsDir, filename);
  if (!target.startsWith(config.uploadsDir)) return;
  fs.promises.unlink(target).catch(() => {});
}

module.exports = { upload, removeUploadedFile };
