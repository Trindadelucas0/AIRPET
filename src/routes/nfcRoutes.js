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
router.post('/:tag_code/encontrei', function (req, res, next) {
  upload.single('foto')(req, res, function (err) {
    if (err) {
      const tagCode = req.params.tag_code;
      if (err.code === 'LIMIT_FILE_SIZE') {
        if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Imagem muito grande. Tamanho máximo: 5 MB. Escolha outra foto ou envie sem foto.' };
      } else {
        if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Erro ao enviar a foto. Use JPEG, PNG, GIF ou WebP.' };
      }
      return res.redirect('/tag/' + encodeURIComponent(tagCode) + '/encontrei');
    }
    next();
  });
}, nfcController.processarEncontrei);
router.get('/:tag_code/enviar-foto', nfcController.mostrarEnviarFoto);
router.post('/:tag_code/enviar-foto', function (req, res, next) {
  upload.single('foto')(req, res, function (err) {
    if (err) {
      const tagCode = req.params.tag_code;
      if (err.code === 'LIMIT_FILE_SIZE') {
        if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Imagem muito grande. Tamanho máximo: 5 MB.' };
      } else {
        if (req.session) req.session.flash = { tipo: 'erro', mensagem: 'Erro ao enviar a foto. Use JPEG, PNG, GIF ou WebP.' };
      }
      return res.redirect('/tag/' + encodeURIComponent(tagCode) + '/enviar-foto');
    }
    next();
  });
}, nfcController.processarEnviarFoto);

module.exports = router;
