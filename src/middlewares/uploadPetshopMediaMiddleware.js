const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const destino = path.join(__dirname, '..', 'public', 'images', 'petshops');
    try {
      fs.mkdirSync(destino, { recursive: true });
      return cb(null, destino);
    } catch (error) {
      return cb(error);
    }
  },
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname || '.jpg')),
});

const uploadPetshopMediaMiddleware = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, allowed.test(ext) && allowed.test(file.mimetype || ''));
  },
});

module.exports = { uploadPetshopMediaMiddleware };
