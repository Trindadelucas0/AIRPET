const path = require('path');
const multer = require('multer');

const uploadPetshopMediaMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, allowed.test(ext) && allowed.test(file.mimetype || ''));
  },
});

module.exports = { uploadPetshopMediaMiddleware };
