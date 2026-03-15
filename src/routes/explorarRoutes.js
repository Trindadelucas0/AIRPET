const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const explorarController = require('../controllers/explorarController');

const postsDir = path.join(__dirname, '..', 'public', 'images', 'posts');
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, postsDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^a-z.]/g, '') || '.jpg';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const extOk = /\.(jpe?g|png|gif|webp)$/.test(ext);
    const mimeOk = !file.mimetype || /image\/(jpeg|png|gif|webp)/.test(file.mimetype);
    cb(null, !!(extOk || mimeOk));
  },
});

router.get('/', explorarController.feed);
router.post('/post', function (req, res, next) {
  upload.single('foto')(req, res, function (err) {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Imagem muito grande (máx. 10 MB).'
        : 'Envie uma imagem válida (JPEG, PNG, GIF ou WebP).';
      return res.status(400).json({ sucesso: false, mensagem: msg });
    }
    next();
  });
}, explorarController.criarPost);
router.post('/post/:id/repost', explorarController.repostar);

router.post('/post/:id/curtir', explorarController.curtir);
router.delete('/post/:id/curtir', explorarController.descurtir);

router.get('/post/:id/comentarios', explorarController.comentarios);
router.get('/post/:id/pets-proximos', explorarController.petsProximosPost);
router.post('/post/:id/comentar', explorarController.comentar);
router.delete('/comentario/:id', explorarController.deletarComentario);

router.post('/post/:id/fixar', explorarController.fixar);
router.delete('/post/:id/fixar', explorarController.desafixar);

router.delete('/post/:id', explorarController.deletarPost);

router.post('/seguir/:id', explorarController.seguir);
router.delete('/seguir/:id', explorarController.deixarDeSeguir);

router.get('/perfil/:id', explorarController.perfilPublico);
router.get('/perfil/:id/seguidores', explorarController.listarSeguidoresUsuario);
router.get('/perfil/:id/seguindo', explorarController.listarSeguindoUsuario);

router.get('/pet/:id/seguidores', explorarController.listarSeguidoresPet);
router.get('/pet/:id/seguindo', explorarController.listarSeguindoPet);
router.get('/pet/:id', explorarController.perfilPet);

router.get('/api/usuarios', explorarController.buscarUsuarios);
router.get('/api/pets', explorarController.buscarPets);

router.post('/pet/:id/seguir', explorarController.seguirPet);
router.delete('/pet/:id/seguir', explorarController.deixarDeSeguirPet);
router.delete('/pet/:id/seguidor/:usuarioId', explorarController.removerSeguidorPet);

router.get('/busca', explorarController.paginaBusca);

module.exports = router;
