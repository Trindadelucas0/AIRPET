const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const ALLOWED_TYPES = /jpeg|jpg|png|gif|webp/;
const MAX_SIZE = 5 * 1024 * 1024;

function criarUpload(destino) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'images', destino)),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname))
  });

  return multer({
    storage,
    limits: { fileSize: MAX_SIZE },
    fileFilter: (req, file, cb) => {
      cb(null, ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase()) && ALLOWED_TYPES.test(file.mimetype));
    }
  });
}

module.exports = {
  uploadPets: criarUpload('pets'),
  uploadDiario: criarUpload('diario'),
  uploadChat: criarUpload('chat'),
  uploadCapa: criarUpload('capa'),
  uploadPerfilGaleria: criarUpload('perfil-galeria'),
  criarUpload,
};
