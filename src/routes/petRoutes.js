const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const petController = require('../controllers/petController');
const { validarPet, validarResultado } = require('../middlewares/validator');

// Configuração do multer para upload de fotos de pets
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

// Listagem de pets do usuário
router.get('/', petController.listar);

// Formulário de cadastro
router.get('/cadastro', petController.mostrarCadastro);

// Criar pet com upload de foto e validação
router.post('/cadastro', upload.single('foto'), validarPet, validarResultado, petController.criar);

// Perfil do pet
router.get('/:id', petController.mostrarPerfil);

// Formulário de edição
router.get('/:id/editar', petController.mostrarEditar);

// Atualizar pet (POST de /editar ou PUT via method-override)
router.post('/:id/editar', upload.single('foto'), petController.atualizar);
router.put('/:id', upload.single('foto'), validarPet, validarResultado, petController.atualizar);

// Página de saúde do pet
router.get('/:id/saude', petController.mostrarSaude);

module.exports = router;
