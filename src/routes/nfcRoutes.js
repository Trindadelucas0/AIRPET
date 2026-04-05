const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const nfcController = require('../controllers/nfcController');
const {
  validarNfcLocalizacaoPublica,
  validarNfcEncontrei,
  validarNfcEnviarFoto,
  validarResultado,
} = require('../middlewares/writeRouteValidators');
const { persistSingle } = require('../middlewares/persistUploadMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  },
});

router.get('/:tag_code', nfcController.processarScan);
router.post('/:tag_code/localizacao', ...validarNfcLocalizacaoPublica, validarResultado, nfcController.registrarLocalizacaoPublica);
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
}, persistSingle('pets'), ...validarNfcEncontrei, validarResultado, nfcController.processarEncontrei);
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
}, persistSingle('pets'), ...validarNfcEnviarFoto, validarResultado, nfcController.processarEnviarFoto);

module.exports = router;
