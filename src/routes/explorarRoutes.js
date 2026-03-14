const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const explorarController = require('../controllers/explorarController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'images', 'posts')),
  filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  },
});

router.get('/', explorarController.feed);
router.post('/post', upload.single('foto'), explorarController.criarPost);
router.post('/post/:id/repost', explorarController.repostar);

router.post('/post/:id/curtir', explorarController.curtir);
router.delete('/post/:id/curtir', explorarController.descurtir);

router.get('/post/:id/comentarios', explorarController.comentarios);
router.post('/post/:id/comentar', explorarController.comentar);
router.delete('/comentario/:id', explorarController.deletarComentario);

router.post('/post/:id/fixar', explorarController.fixar);
router.delete('/post/:id/fixar', explorarController.desafixar);

router.delete('/post/:id', explorarController.deletarPost);

router.post('/seguir/:id', explorarController.seguir);
router.delete('/seguir/:id', explorarController.deixarDeSeguir);

router.get('/perfil/:id', explorarController.perfilPublico);

router.get('/api/usuarios', explorarController.buscarUsuarios);
router.get('/api/pets', explorarController.buscarPets);

router.post('/pet/:id/seguir', explorarController.seguirPet);
router.delete('/pet/:id/seguir', explorarController.deixarDeSeguirPet);

router.get('/busca', explorarController.paginaBusca);

module.exports = router;
