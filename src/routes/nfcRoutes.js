const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const nfcController = require('../controllers/nfcController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'images', 'pets')),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

router.get('/:tag_code', nfcController.processarScan);
router.post('/:tag_code/localizacao', nfcController.registrarLocalizacaoPublica);
router.get('/:tag_code/encontrei', nfcController.mostrarEncontrei);
router.post('/:tag_code/encontrei', upload.single('foto'), nfcController.processarEncontrei);
router.get('/:tag_code/enviar-foto', nfcController.mostrarEnviarFoto);
router.post('/:tag_code/enviar-foto', upload.single('foto'), nfcController.processarEnviarFoto);

module.exports = router;
