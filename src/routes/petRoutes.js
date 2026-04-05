const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const petController = require('../controllers/petController');
const { validarPet, validarResultado, camposPermitidos, CAMPOS_PET_FORM } = require('../middlewares/validator');
const { validarVincularTag } = require('../middlewares/writeRouteValidators');
const { persistSingle } = require('../middlewares/persistUploadMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  },
});

// Listagem de pets do usuário
router.get('/', petController.listar);

// Formulário de cadastro
router.get('/cadastro', petController.mostrarCadastro);

// Criar pet com upload de foto e validação
router.post(
  '/cadastro',
  upload.single('foto'),
  persistSingle('pets'),
  camposPermitidos(CAMPOS_PET_FORM),
  validarPet,
  validarResultado,
  petController.criar
);

// Vincular tag NFC ao pet
router.get('/:id/vincular-tag', petController.mostrarVincularTag);
router.post('/:id/vincular-tag', ...validarVincularTag, validarResultado, petController.vincularTag);

// Perfil do pet
router.get('/:id', petController.mostrarPerfil);

// Formulário de edição
router.get('/:id/editar', petController.mostrarEditar);

function handleUploadErro(req, res, next) {
  return function (err) {
    if (err) {
      req.session.flash = {
        tipo: 'erro',
        mensagem: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem muito grande (máx. 5 MB).' : 'Envie uma imagem válida (JPEG, PNG, GIF ou WebP).',
      };
      return res.redirect('back');
    }
    next();
  };
}
// Atualizar pet (POST de /editar ou PUT via method-override)
router.post('/:id/editar', function (req, res, next) {
  upload.single('foto')(req, res, handleUploadErro(req, res, next));
}, persistSingle('pets'), camposPermitidos(CAMPOS_PET_FORM), validarPet, validarResultado, petController.atualizar);
router.put('/:id', function (req, res, next) {
  upload.single('foto')(req, res, handleUploadErro(req, res, next));
}, persistSingle('pets'), camposPermitidos(CAMPOS_PET_FORM), validarPet, validarResultado, petController.atualizar);

// Página de saúde do pet
router.get('/:id/saude', petController.mostrarSaude);

module.exports = router;
