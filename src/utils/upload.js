const multer = require('multer');
const path = require('path');

const ALLOWED_TYPES = /jpeg|jpg|png|gif|webp/;
const MAX_SIZE = 5 * 1024 * 1024;

function criarUploadMemoria(destino, maxSize = MAX_SIZE, fileFilter) {
  const filter =
    fileFilter ||
    ((req, file, cb) => {
      cb(null, ALLOWED_TYPES.test(path.extname(file.originalname).toLowerCase()) && ALLOWED_TYPES.test(file.mimetype));
    });
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: filter,
  });
}

/** @deprecated usar criarUploadMemoria — mantido para compat */
function criarUpload(destino) {
  return criarUploadMemoria(destino);
}

module.exports = {
  uploadPets: criarUploadMemoria('pets'),
  uploadChat: criarUploadMemoria('chat'),
  uploadCapa: criarUploadMemoria('capa'),
  uploadPerfilGaleria: criarUploadMemoria('perfil-galeria'),
  criarUpload,
  criarUploadMemoria,
};
